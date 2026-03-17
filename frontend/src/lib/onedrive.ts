/**
 * OneDrive integration via Microsoft Graph API
 * Uses client credentials (app-only) flow — single shared OneDrive account
 */
import { ConfidentialClientApplication } from '@azure/msal-node';

// ═══ Config ═══
const TENANT_ID = process.env.AZURE_TENANT_ID || '';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const DRIVE_ID = process.env.ONEDRIVE_DRIVE_ID || '';
const ROOT_FOLDER = process.env.ONEDRIVE_ROOT_FOLDER || 'GiaPha-Photos';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// ═══ MSAL client (singleton) ═══
let _msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
    if (!_msalClient) {
        if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
            throw new Error('Missing Azure AD credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)');
        }
        _msalClient = new ConfidentialClientApplication({
            auth: {
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                authority: `https://login.microsoftonline.com/${TENANT_ID}`,
            },
        });
    }
    return _msalClient;
}

// ═══ Token management ═══
let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (_cachedToken && _cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
        return _cachedToken.token;
    }

    const client = getMsalClient();
    const result = await client.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!result || !result.accessToken) {
        throw new Error('Failed to acquire access token');
    }

    _cachedToken = {
        token: result.accessToken,
        expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600 * 1000,
    };

    return result.accessToken;
}

// ═══ Graph API helper ═══
async function graphFetch(path: string, options: RequestInit = {}): Promise<any> {
    const token = await getAccessToken();
    const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Graph API error ${res.status}: ${errText}`);
    }

    // Some responses (204 No Content) don't have body
    if (res.status === 204) return null;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return res.json();
    }
    return res.text();
}

// Drive path helper
function drivePath(subPath: string = ''): string {
    if (DRIVE_ID) {
        return `/drives/${DRIVE_ID}/root:/${ROOT_FOLDER}${subPath ? '/' + subPath : ''}:`;
    }
    // Fallback: use /me/drive (requires delegated, won't work with app-only for personal)
    return `/me/drive/root:/${ROOT_FOLDER}${subPath ? '/' + subPath : ''}:`;
}

function driveItemPath(itemId: string): string {
    if (DRIVE_ID) {
        return `/drives/${DRIVE_ID}/items/${itemId}`;
    }
    return `/me/drive/items/${itemId}`;
}

// ═══ Public API ═══

export interface OneDriveItem {
    id: string;
    name: string;
    size: number;
    createdDateTime: string;
    lastModifiedDateTime: string;
    webUrl: string;
    folder?: { childCount: number };
    image?: { width: number; height: number };
    file?: { mimeType: string };
    thumbnails?: Array<{
        small?: { url: string; width: number; height: number };
        medium?: { url: string; width: number; height: number };
        large?: { url: string; width: number; height: number };
    }>;
    '@microsoft.graph.downloadUrl'?: string;
}

/**
 * Ensure the root folder (GiaPha-Photos) exists
 */
export async function ensureRootFolder(): Promise<OneDriveItem> {
    try {
        const existing = await graphFetch(`${drivePath()}?$select=id,name`);
        return existing;
    } catch {
        // Folder doesn't exist, create it
        const parentPath = DRIVE_ID
            ? `/drives/${DRIVE_ID}/root/children`
            : `/me/drive/root/children`;
        return graphFetch(parentPath, {
            method: 'POST',
            body: JSON.stringify({
                name: ROOT_FOLDER,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'fail',
            }),
        });
    }
}

/**
 * List album folders inside the root folder
 */
export async function listAlbumFolders(): Promise<OneDriveItem[]> {
    const data = await graphFetch(
        `${drivePath()}/children?$filter=folder ne null&$expand=thumbnails&$select=id,name,folder,createdDateTime,lastModifiedDateTime,webUrl,thumbnails`
    );
    return data.value || [];
}

/**
 * List photos (images) in a specific folder
 */
export async function listPhotosInFolder(folderId: string): Promise<OneDriveItem[]> {
    const data = await graphFetch(
        `${driveItemPath(folderId)}/children?$expand=thumbnails&$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,image,file,thumbnails&$filter=file ne null`
    );
    return (data.value || []).filter((item: OneDriveItem) =>
        item.file?.mimeType?.startsWith('image/')
    );
}

/**
 * List ALL photos across all album folders
 */
export async function listAllPhotos(): Promise<{ item: OneDriveItem; folderId: string; folderName: string }[]> {
    const folders = await listAlbumFolders();
    const allPhotos: { item: OneDriveItem; folderId: string; folderName: string }[] = [];

    for (const folder of folders) {
        const photos = await listPhotosInFolder(folder.id);
        for (const photo of photos) {
            allPhotos.push({ item: photo, folderId: folder.id, folderName: folder.name });
        }
    }

    // Sort by date, newest first
    allPhotos.sort((a, b) =>
        new Date(b.item.createdDateTime).getTime() - new Date(a.item.createdDateTime).getTime()
    );

    return allPhotos;
}

/**
 * Get a single item with download URL and thumbnails
 */
export async function getItem(itemId: string): Promise<OneDriveItem> {
    return graphFetch(
        `${driveItemPath(itemId)}?$expand=thumbnails&$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,image,file,thumbnails,@microsoft.graph.downloadUrl`
    );
}

/**
 * Get the direct download URL for an item
 */
export async function getDownloadUrl(itemId: string): Promise<string> {
    const item = await graphFetch(
        `${driveItemPath(itemId)}?$select=id,@microsoft.graph.downloadUrl`
    );
    return item['@microsoft.graph.downloadUrl'] || '';
}

/**
 * Create a new folder (album) inside the root folder
 */
export async function createAlbumFolder(name: string): Promise<OneDriveItem> {
    const root = await ensureRootFolder();
    return graphFetch(`${driveItemPath(root.id)}/children`, {
        method: 'POST',
        body: JSON.stringify({
            name,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
        }),
    });
}

/**
 * Upload a photo to a folder
 * For files < 4MB, uses simple upload. For larger files, would need upload session.
 */
export async function uploadPhoto(
    folderId: string,
    fileName: string,
    fileBuffer: ArrayBuffer | Uint8Array,
    mimeType: string
): Promise<OneDriveItem> {
    const token = await getAccessToken();

    // Simple upload (< 4MB) — PUT to content endpoint
    const uploadPath = `${GRAPH_BASE}${driveItemPath(folderId)}:/${encodeURIComponent(fileName)}:/content`;

    const res = await fetch(uploadPath, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': mimeType,
            'Content-Length': String(fileBuffer.byteLength),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: fileBuffer as any,
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Upload failed ${res.status}: ${errText}`);
    }

    return res.json();
}

/**
 * Create an upload session for large files (> 4MB)
 */
export async function createUploadSession(
    folderId: string,
    fileName: string
): Promise<{ uploadUrl: string }> {
    return graphFetch(
        `${driveItemPath(folderId)}:/${encodeURIComponent(fileName)}:/createUploadSession`,
        {
            method: 'POST',
            body: JSON.stringify({
                item: {
                    '@microsoft.graph.conflictBehavior': 'rename',
                    name: fileName,
                },
            }),
        }
    );
}

/**
 * Delete an item (photo or folder)
 */
export async function deleteItem(itemId: string): Promise<void> {
    await graphFetch(driveItemPath(itemId), { method: 'DELETE' });
}

/**
 * Rename an item
 */
export async function renameItem(itemId: string, newName: string): Promise<OneDriveItem> {
    return graphFetch(driveItemPath(itemId), {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
    });
}

/**
 * Get thumbnail URLs for an item
 */
export function getThumbnailUrls(item: OneDriveItem): {
    small?: string;
    medium?: string;
    large?: string;
} {
    const thumb = item.thumbnails?.[0];
    if (!thumb) return {};
    return {
        small: thumb.small?.url,
        medium: thumb.medium?.url,
        large: thumb.large?.url,
    };
}

/**
 * Check if OneDrive is configured
 */
export function isConfigured(): boolean {
    return !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET && DRIVE_ID);
}
