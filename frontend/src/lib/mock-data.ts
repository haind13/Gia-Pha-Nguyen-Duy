/**
 * Mock data — Dòng họ Nguyễn Duy — Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình
 * Generated from Gia_Pha_Nguyen_Duy_Supabase.csv
 * 118 thành viên, 15 thế hệ
 */
import type { TreeNode, TreeFamily } from './tree-layout';

export const MOCK_PEOPLE: TreeNode[] = [
    // ═══ Đời 1 ═══
    { handle: 'D01-001', displayName: 'Nguyễn Duy Hòa', gender: 1, generation: 1, birthYear: 1496, deathYear: 1577, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F001'], parentFamilies: [] },
    { handle: 'S_D01-001', displayName: 'Nghiêm Quý Thị', gender: 2, generation: 1, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 2 ═══
    { handle: 'D02-001', displayName: 'Nguyễn Duy Riễn', gender: 1, generation: 2, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F001'] },
    { handle: 'D02-002', displayName: 'Nguyễn Duy Tân', gender: 1, generation: 2, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F001'] },
    { handle: 'D02-003', displayName: 'Nguyễn Duy Trạch', gender: 1, generation: 2, birthYear: 1524, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F002'], parentFamilies: ['F001'] },
    // ═══ Đời 3 ═══
    { handle: 'D03-001', displayName: 'Nguyễn Duy Hộ', gender: 1, generation: 3, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F003'], parentFamilies: ['F002'] },
    { handle: 'S_D03-001', displayName: 'Đỗ Thị Chung', gender: 2, generation: 3, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 4 ═══
    { handle: 'D04-001', displayName: 'Nguyễn Duy Khối', gender: 1, generation: 4, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F004'], parentFamilies: ['F003'] },
    // ═══ Đời 5 ═══
    { handle: 'D05-001', displayName: 'Nguyễn Duy Điển', gender: 1, generation: 5, birthYear: 1672, deathYear: 1711, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F005'], parentFamilies: ['F004'] },
    { handle: 'S_D05-001', displayName: 'Ngụy Thị Trong', gender: 2, generation: 5, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 6 ═══
    { handle: 'D06-001', displayName: 'Nguyễn Duy Roãn', gender: 1, generation: 6, birthYear: 1708, deathYear: 1775, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F006'], parentFamilies: ['F005'] },
    { handle: 'D06-002', displayName: 'Nguyễn Duy Cúc', gender: 1, generation: 6, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F005'] },
    { handle: 'D06-003', displayName: 'Nguyễn Duy (Quế Vũ)', gender: 1, generation: 6, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F005'] },
    { handle: 'S_D06-001', displayName: 'Vũ Thị Hòa', gender: 2, generation: 6, birthYear: 1706, deathYear: 1781, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 7 ═══
    { handle: 'D07-001', displayName: 'Nguyễn Duy Vẽ', gender: 1, generation: 7, birthYear: 1723, deathYear: 1788, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F007'], parentFamilies: ['F006'] },
    { handle: 'S_D07-001', displayName: 'Vũ Thị Phao', gender: 2, generation: 7, birthYear: 1734, deathYear: 1794, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 8 ═══
    { handle: 'D08-001', displayName: 'Nguyễn Duy Hoán', gender: 1, generation: 8, birthYear: 1759, deathYear: 1821, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F008'], parentFamilies: ['F007'] },
    { handle: 'D08-002', displayName: 'Nguyễn Duy Đầm', gender: 1, generation: 8, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F007'] },
    { handle: 'S_D08-001', displayName: 'Vũ Thị Doan', gender: 2, generation: 8, birthYear: 1774, deathYear: 1835, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 9 ═══
    { handle: 'D09-001', displayName: 'Nguyễn Duy Bang', gender: 1, generation: 9, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F008'] },
    { handle: 'D09-002', displayName: 'Nguyễn Duy Nham', gender: 1, generation: 9, birthYear: 1795, deathYear: 1862, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F009'], parentFamilies: ['F008'] },
    { handle: 'D09-003', displayName: 'Nguyễn Duy Quý', gender: 1, generation: 9, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F008'] },
    { handle: 'S_D09-002', displayName: 'họ Đặng', gender: 2, generation: 9, birthYear: 1794, deathYear: 1862, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 10 ═══
    { handle: 'D10-001', displayName: 'Nguyễn Duy Trinh', gender: 1, generation: 10, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F009'] },
    { handle: 'D10-002', displayName: 'Nguyễn Duy Khanh', gender: 1, generation: 10, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F009'] },
    { handle: 'D10-003', displayName: 'Nguyễn Duy Khoan Giản', gender: 1, generation: 10, birthYear: 1832, deathYear: 1868, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F010'], parentFamilies: ['F009'] },
    { handle: 'S_D10-003', displayName: 'Trần Thị', gender: 2, generation: 10, birthYear: 1830, deathYear: 1894, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 11 ═══
    { handle: 'D10-004', displayName: 'Nguyễn Thị Ngọc', gender: 2, generation: 11, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F010'] },
    { handle: 'D11-001', displayName: 'Nguyễn Duy Khâm', gender: 1, generation: 11, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F011'], parentFamilies: ['F010'] },
    { handle: 'D11-002', displayName: 'Nguyễn Duy Sảng', gender: 1, generation: 11, birthYear: 1856, deathYear: 1921, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F012'], parentFamilies: ['F010'] },
    { handle: 'S_D11-001', displayName: 'Nguyễn Thị Viễn', gender: 2, generation: 11, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D11-002', displayName: 'Phạm Thị Lượt', gender: 2, generation: 11, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 12 ═══
    { handle: 'D12-T01', displayName: 'Nguyễn Duy Tồm', gender: 1, generation: 12, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F011'] },
    { handle: 'D11-G01', displayName: 'Nguyễn Thị Dược', gender: 2, generation: 12, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F011'] },
    { handle: 'D11-G02', displayName: 'Nguyễn Thị Toán', gender: 2, generation: 12, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F011'] },
    { handle: 'D12-001a', displayName: 'Nguyễn Duy Oong', gender: 1, generation: 12, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F012'] },
    { handle: 'D12-001b', displayName: 'Nguyễn Duy Thấm', gender: 1, generation: 12, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F012'] },
    { handle: 'D12-001', displayName: 'Nguyễn Duy Thâm', gender: 1, generation: 12, birthYear: 1890, deathYear: 1953, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F013'], parentFamilies: ['F012'] },
    { handle: 'D12-G01', displayName: 'Nguyễn Thị Sửu', gender: 2, generation: 12, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F012'] },
    { handle: 'D12-G02', displayName: 'Nguyễn Thị Tý', gender: 2, generation: 12, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F012'] },
    { handle: 'D12-G03', displayName: 'Nguyễn Thị Cỏn', gender: 2, generation: 12, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F012'] },
    { handle: 'D12-002', displayName: 'Nguyễn Duy Hoạt', gender: 1, generation: 12, birthYear: 1908, deathYear: 1932, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F014'], parentFamilies: ['F012'] },
    { handle: 'S_D12-001', displayName: 'Lương Thị Tiệp', gender: 2, generation: 12, birthYear: 1892, deathYear: 1983, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D12-002', displayName: 'Nguyễn Thị Xa', gender: 2, generation: 12, birthYear: 1964, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 13 ═══
    { handle: 'D13-001', displayName: 'Nguyễn Duy Thiển', gender: 1, generation: 13, birthYear: 1915, deathYear: 1983, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F015'], parentFamilies: ['F013'] },
    { handle: 'D13-002', displayName: 'Nguyễn Thị Điềm', gender: 2, generation: 13, birthYear: 1919, deathYear: 2003, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F013'] },
    { handle: 'D13-003', displayName: 'Nguyễn Duy Xung', gender: 1, generation: 13, birthYear: 1921, deathYear: 2004, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F016'], parentFamilies: ['F013'] },
    { handle: 'D13-004', displayName: 'Nguyễn Duy Cảng', gender: 1, generation: 13, birthYear: 1924, deathYear: 1946, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F013'] },
    { handle: 'D13-005', displayName: 'Nguyễn Duy Đỗng', gender: 1, generation: 13, birthYear: 1928, deathYear: 1971, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F017'], parentFamilies: ['F013'] },
    { handle: 'D13-006', displayName: 'Nguyễn Thị Én', gender: 2, generation: 13, birthYear: 1930, deathYear: 2018, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F013'] },
    { handle: 'D13-007', displayName: 'Nguyễn Duy Bàng', gender: 1, generation: 13, birthYear: 1933, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F018'], parentFamilies: ['F013'] },
    { handle: 'D13-008', displayName: 'Nguyễn Duy Luân', gender: 1, generation: 13, birthYear: 1927, deathYear: 2001, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F019'], parentFamilies: ['F014'] },
    { handle: 'D13-009', displayName: 'Nguyễn Duy Luận', gender: 1, generation: 13, birthYear: 1930, deathYear: 1951, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F020'], parentFamilies: ['F014'] },
    { handle: 'S_D13-001', displayName: 'Nguyễn Thị Thươm', gender: 2, generation: 13, birthYear: 1919, deathYear: 1995, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D13-003', displayName: 'Trần Thị Hoan', gender: 2, generation: 13, birthYear: 1922, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D13-005', displayName: 'Nguyễn Thị Nhàn', gender: 2, generation: 13, birthYear: 1925, deathYear: 2017, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D13-007', displayName: 'Nguyễn Thị Cúc', gender: 2, generation: 13, birthYear: 1936, deathYear: 1998, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D13-008', displayName: 'Đỗ Thị Bẩy', gender: 2, generation: 13, birthYear: 2010, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D13-009', displayName: 'Đỗ Thị Nhãn', gender: 2, generation: 13, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 14 ═══
    { handle: 'D14-001', displayName: 'Nguyễn Thị Gái', gender: 2, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F015'] },
    { handle: 'D14-002', displayName: 'Nguyễn Duy Lẫm', gender: 1, generation: 14, birthYear: 1940, deathYear: 2018, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F021'], parentFamilies: ['F015'] },
    { handle: 'D14-003', displayName: 'Nguyễn Duy Lãm', gender: 1, generation: 14, birthYear: 1945, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F022'], parentFamilies: ['F015'] },
    { handle: 'D14-004', displayName: 'Nguyễn Thị Loan', gender: 2, generation: 14, birthYear: 1958, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F023'], parentFamilies: ['F015'] },
    { handle: 'D14-005', displayName: 'Nguyễn Duy Lương', gender: 1, generation: 14, birthYear: 1961, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F024'], parentFamilies: ['F015'] },
    { handle: 'D14-006', displayName: 'Nguyễn Thị Dung', gender: 2, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F016'] },
    { handle: 'D14-007', displayName: 'Nguyễn Duy Chuyên', gender: 1, generation: 14, birthYear: 1945, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F025'], parentFamilies: ['F016'] },
    { handle: 'D14-008', displayName: 'Nguyễn Duy Chung', gender: 1, generation: 14, birthYear: 1948, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F026'], parentFamilies: ['F016'] },
    { handle: 'D14-009', displayName: 'Nguyễn Thị Thành', gender: 2, generation: 14, birthYear: 1954, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F016'] },
    { handle: 'D14-010', displayName: 'Nguyễn Thị Chính', gender: 2, generation: 14, birthYear: 1958, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F016'] },
    { handle: 'D14-011', displayName: 'Nguyễn Duy Dũng', gender: 1, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F017'] },
    { handle: 'D14-012', displayName: 'Nguyễn Duy Quỳnh', gender: 1, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F017'] },
    { handle: 'D14-013', displayName: 'Nguyễn Duy Đông', gender: 1, generation: 14, birthYear: 1957, deathYear: 2018, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F027'], parentFamilies: ['F017'] },
    { handle: 'D14-014', displayName: 'Nguyễn Thị Phương', gender: 2, generation: 14, birthYear: 1959, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F017'] },
    { handle: 'D14-015', displayName: 'Nguyễn Thị Hồng', gender: 2, generation: 14, birthYear: 1967, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F017'] },
    { handle: 'D14-016', displayName: 'Nguyễn Thị Huyền', gender: 2, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F018'] },
    { handle: 'D14-017', displayName: 'Nguyễn Duy Minh', gender: 1, generation: 14, birthYear: 1961, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F028'], parentFamilies: ['F018'] },
    { handle: 'D14-018', displayName: 'Nguyễn Thị Hồng Vân', gender: 2, generation: 14, birthYear: 1964, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F018'] },
    { handle: 'D14-019', displayName: 'Nguyễn Thị Minh Nguyệt', gender: 2, generation: 14, birthYear: 1968, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F018'] },
    { handle: 'D14-020', displayName: 'Nguyễn Thị Nho', gender: 2, generation: 14, birthYear: 1952, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-021', displayName: 'Nguyễn Duy Quân', gender: 1, generation: 14, birthYear: 1954, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F029'], parentFamilies: ['F019'] },
    { handle: 'D14-022', displayName: 'Nguyễn Duy Đỏ', gender: 1, generation: 14, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-023', displayName: 'Nguyễn Thị Mâu', gender: 2, generation: 14, birthYear: 1956, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-024', displayName: 'Nguyễn Thị Ngoan', gender: 2, generation: 14, birthYear: 1958, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-025', displayName: 'Nguyễn Thị Ngoãn', gender: 2, generation: 14, birthYear: 1958, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-026', displayName: 'Nguyễn Thị Nhâm', gender: 2, generation: 14, birthYear: 1961, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-027', displayName: 'Nguyễn Duy Phi', gender: 1, generation: 14, birthYear: 1963, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-028', displayName: 'Nguyễn Thị Quý', gender: 2, generation: 14, birthYear: 1965, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-029', displayName: 'Nguyễn Thị Tốt', gender: 2, generation: 14, birthYear: 1967, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-030', displayName: 'Nguyễn Thị Hồng Lĩnh', gender: 2, generation: 14, birthYear: 1969, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-031', displayName: 'Nguyễn Thị Khánh Dư', gender: 2, generation: 14, birthYear: 1971, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F019'] },
    { handle: 'D14-032', displayName: 'Nguyễn Thị Lê', gender: 2, generation: 14, birthYear: 1950, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F020'] },
    { handle: 'D14-033', displayName: 'Nguyễn Duy Đan', gender: 1, generation: 14, birthYear: 1951, deathYear: 1960, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F020'] },
    { handle: 'S_D14-002', displayName: 'Bùi Thị Tân Thư', gender: 2, generation: 14, birthYear: 1943, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-003', displayName: 'Nguyễn Thị Kim Loan', gender: 2, generation: 14, birthYear: 1950, deathYear: 2022, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-004', displayName: 'NguyễnQuang Minh', gender: 2, generation: 14, birthYear: 1956, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-005', displayName: 'Nguyễn Thị Thu Thủy', gender: 2, generation: 14, birthYear: 1971, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-007', displayName: 'Lê Thị Thơ', gender: 2, generation: 14, birthYear: 1952, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-008', displayName: 'Ninh Thị Ty', gender: 2, generation: 14, birthYear: 1954, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-013', displayName: 'Nguyễn Thị Loan', gender: 2, generation: 14, birthYear: 1969, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-017', displayName: 'Nguyễn Thị Hiền', gender: 2, generation: 14, birthYear: 1968, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'S_D14-021', displayName: 'Đặng Thị Phương', gender: 2, generation: 14, birthYear: 1954, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    // ═══ Đời 15 ═══
    { handle: 'D15-001', displayName: 'Nguyễn Thanh Giang', gender: 2, generation: 15, birthYear: 1974, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F021'] },
    { handle: 'D15-002', displayName: 'Nguyễn Duy Việt Phong', gender: 1, generation: 15, birthYear: 1976, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F021'] },
    { handle: 'D15-003', displayName: 'Nguyễn Duy Hoàng', gender: 1, generation: 15, birthYear: 1983, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F022'] },
    { handle: 'D15-004', displayName: 'Nguyễn Duy Hải', gender: 1, generation: 15, birthYear: 1991, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F022'] },
    { handle: 'D15-005', displayName: 'Nguyễn Thị Phương Liên', gender: 2, generation: 15, birthYear: 1987, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F023'] },
    { handle: 'D15-006', displayName: 'Nguyễn Duy Thành', gender: 1, generation: 15, birthYear: 1993, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F024'] },
    { handle: 'D15-007', displayName: 'Nguyễn Duy Đức', gender: 1, generation: 15, birthYear: 2001, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F024'] },
    { handle: 'D15-008', displayName: 'Nguyễn Duy Hoàng Hải', gender: 1, generation: 15, birthYear: 1978, deathYear: 2004, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F025'] },
    { handle: 'D15-009', displayName: 'Nguyễn Thị Hoàng Yến', gender: 2, generation: 15, birthYear: 1982, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F025'] },
    { handle: 'D15-010', displayName: 'Nguyễn Duy Ninh', gender: 1, generation: 15, birthYear: 1981, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F026'] },
    { handle: 'D15-011', displayName: 'Nguyễn Thị Hải Yến', gender: 2, generation: 15, birthYear: 1990, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F026'] },
    { handle: 'D15-012', displayName: 'Nguyễn Thị Thùy Linh', gender: 2, generation: 15, birthYear: 1995, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F027'] },
    { handle: 'D15-013', displayName: 'Nguyễn Thị Hà Chi', gender: 2, generation: 15, birthYear: 1999, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F027'] },
    { handle: 'D15-014', displayName: 'Nguyễn Duy Bình', gender: 1, generation: 15, birthYear: 1998, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F028'] },
    { handle: 'D15-015', displayName: 'Nguyễn Thị Giang', gender: 2, generation: 15, birthYear: 1976, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F029'] },
    { handle: 'D15-016', displayName: 'Nguyễn Duy Công', gender: 1, generation: 15, birthYear: 1980, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F029'] },
    { handle: 'D15-017', displayName: 'Nguyễn Thị Dung', gender: 2, generation: 15, birthYear: 1986, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F029'] },
];

export const MOCK_FAMILIES: TreeFamily[] = [
    { handle: 'F001', fatherHandle: 'D01-001', motherHandle: 'S_D01-001', children: ['D02-001', 'D02-002', 'D02-003'] },
    { handle: 'F002', fatherHandle: 'D02-003', children: ['D03-001'] },
    { handle: 'F003', fatherHandle: 'D03-001', motherHandle: 'S_D03-001', children: ['D04-001'] },
    { handle: 'F004', fatherHandle: 'D04-001', children: ['D05-001'] },
    { handle: 'F005', fatherHandle: 'D05-001', motherHandle: 'S_D05-001', children: ['D06-001', 'D06-002', 'D06-003'] },
    { handle: 'F006', fatherHandle: 'D06-001', motherHandle: 'S_D06-001', children: ['D07-001'] },
    { handle: 'F007', fatherHandle: 'D07-001', motherHandle: 'S_D07-001', children: ['D08-001', 'D08-002'] },
    { handle: 'F008', fatherHandle: 'D08-001', motherHandle: 'S_D08-001', children: ['D09-001', 'D09-002', 'D09-003'] },
    { handle: 'F009', fatherHandle: 'D09-002', motherHandle: 'S_D09-002', children: ['D10-001', 'D10-002', 'D10-003'] },
    { handle: 'F010', fatherHandle: 'D10-003', motherHandle: 'S_D10-003', children: ['D10-004', 'D11-001', 'D11-002'] },
    { handle: 'F011', fatherHandle: 'D11-001', motherHandle: 'S_D11-001', children: ['D12-T01', 'D11-G01', 'D11-G02'] },
    { handle: 'F012', fatherHandle: 'D11-002', motherHandle: 'S_D11-002', children: ['D12-001a', 'D12-001b', 'D12-001', 'D12-G01', 'D12-G02', 'D12-G03', 'D12-002'] },
    { handle: 'F013', fatherHandle: 'D12-001', motherHandle: 'S_D12-001', children: ['D13-001', 'D13-002', 'D13-003', 'D13-004', 'D13-005', 'D13-006', 'D13-007'] },
    { handle: 'F014', fatherHandle: 'D12-002', motherHandle: 'S_D12-002', children: ['D13-008', 'D13-009'] },
    { handle: 'F015', fatherHandle: 'D13-001', motherHandle: 'S_D13-001', children: ['D14-001', 'D14-002', 'D14-003', 'D14-004', 'D14-005'] },
    { handle: 'F016', fatherHandle: 'D13-003', motherHandle: 'S_D13-003', children: ['D14-006', 'D14-007', 'D14-008', 'D14-009', 'D14-010'] },
    { handle: 'F017', fatherHandle: 'D13-005', motherHandle: 'S_D13-005', children: ['D14-011', 'D14-012', 'D14-013', 'D14-014', 'D14-015'] },
    { handle: 'F018', fatherHandle: 'D13-007', motherHandle: 'S_D13-007', children: ['D14-016', 'D14-017', 'D14-018', 'D14-019'] },
    { handle: 'F019', fatherHandle: 'D13-008', motherHandle: 'S_D13-008', children: ['D14-020', 'D14-021', 'D14-022', 'D14-023', 'D14-024', 'D14-025', 'D14-026', 'D14-027', 'D14-028', 'D14-029', 'D14-030', 'D14-031'] },
    { handle: 'F020', fatherHandle: 'D13-009', motherHandle: 'S_D13-009', children: ['D14-032', 'D14-033'] },
    { handle: 'F021', fatherHandle: 'D14-002', motherHandle: 'S_D14-002', children: ['D15-001', 'D15-002'] },
    { handle: 'F022', fatherHandle: 'D14-003', motherHandle: 'S_D14-003', children: ['D15-003', 'D15-004'] },
    { handle: 'F023', fatherHandle: 'D14-004', motherHandle: 'S_D14-004', children: ['D15-005'] },
    { handle: 'F024', fatherHandle: 'D14-005', motherHandle: 'S_D14-005', children: ['D15-006', 'D15-007'] },
    { handle: 'F025', fatherHandle: 'D14-007', motherHandle: 'S_D14-007', children: ['D15-008', 'D15-009'] },
    { handle: 'F026', fatherHandle: 'D14-008', motherHandle: 'S_D14-008', children: ['D15-010', 'D15-011'] },
    { handle: 'F027', fatherHandle: 'D14-013', motherHandle: 'S_D14-013', children: ['D15-012', 'D15-013'] },
    { handle: 'F028', fatherHandle: 'D14-017', motherHandle: 'S_D14-017', children: ['D15-014'] },
    { handle: 'F029', fatherHandle: 'D14-021', motherHandle: 'S_D14-021', children: ['D15-015', 'D15-016', 'D15-017'] },
];

export interface MemorialEvent {
    personHandle: string;
    personName: string;
    generation: number;
    day: number;
    month: number;
    deathYear?: number;
    isLunar: boolean;
}

export const MOCK_MEMORIALS: MemorialEvent[] = [
    { personHandle: 'D05-001', personName: 'Nguyễn Duy Điển', generation: 5, day: 5, month: 1, deathYear: 1711, isLunar: true },
    { personHandle: 'D04-001', personName: 'Nguyễn Duy Khối', generation: 4, day: 8, month: 1, isLunar: true },
    { personHandle: 'D13-009', personName: 'Nguyễn Duy Luận', generation: 13, day: 26, month: 1, deathYear: 1951, isLunar: true },
    { personHandle: 'D07-001', personName: 'Nguyễn Duy Vẽ', generation: 7, day: 17, month: 2, deathYear: 1788, isLunar: true },
    { personHandle: 'S_D13-008', personName: 'Đỗ Thị Bẩy', generation: 13, day: 7, month: 3, deathYear: 2010, isLunar: false },
    { personHandle: 'D13-008', personName: 'Nguyễn Duy Luân', generation: 13, day: 17, month: 3, deathYear: 2001, isLunar: true },
    { personHandle: 'D03-001', personName: 'Nguyễn Duy Hộ', generation: 3, day: 15, month: 5, isLunar: true },
    { personHandle: 'S_D11-002', personName: 'Phạm Thị Lượt', generation: 11, day: 20, month: 5, isLunar: true },
    { personHandle: 'D09-002', personName: 'Nguyễn Duy Nham', generation: 9, day: 3, month: 6, deathYear: 1862, isLunar: true },
    { personHandle: 'D12-T01', personName: 'Nguyễn Duy Tồm', generation: 12, day: 10, month: 6, isLunar: true },
    { personHandle: 'D13-003', personName: 'Nguyễn Duy Xung', generation: 13, day: 11, month: 6, deathYear: 2004, isLunar: true },
    { personHandle: 'D02-003', personName: 'Nguyễn Duy Trạch', generation: 2, day: 15, month: 6, isLunar: true },
    { personHandle: 'D14-013', personName: 'Nguyễn Duy Đông', generation: 14, day: 23, month: 6, deathYear: 2018, isLunar: true },
    { personHandle: 'D10-003', personName: 'Nguyễn Duy Khoan Giản', generation: 10, day: 28, month: 6, deathYear: 1868, isLunar: true },
    { personHandle: 'S_D12-001', personName: 'Lương Thị Tiệp', generation: 12, day: 28, month: 6, deathYear: 1983, isLunar: false },
    { personHandle: 'D14-002', personName: 'Nguyễn Duy Lẫm', generation: 14, day: 18, month: 7, deathYear: 2018, isLunar: true },
    { personHandle: 'S_D13-001', personName: 'Nguyễn Thị Thươm', generation: 13, day: 19, month: 7, deathYear: 1995, isLunar: false },
    { personHandle: 'D01-001', personName: 'Nguyễn Duy Hòa', generation: 1, day: 30, month: 7, deathYear: 1577, isLunar: true },
    { personHandle: 'D11-001', personName: 'Nguyễn Duy Khâm', generation: 11, day: 30, month: 7, isLunar: true },
    { personHandle: 'S_D13-007', personName: 'Nguyễn Thị Cúc', generation: 13, day: 24, month: 8, deathYear: 1998, isLunar: false },
    { personHandle: 'D13-001', personName: 'Nguyễn Duy Thiển', generation: 13, day: 2, month: 9, deathYear: 1983, isLunar: true },
    { personHandle: 'D13-005', personName: 'Nguyễn Duy Đỗng', generation: 13, day: 2, month: 9, deathYear: 1971, isLunar: true },
    { personHandle: 'D13-004', personName: 'Nguyễn Duy Cảng', generation: 13, day: 20, month: 9, deathYear: 1946, isLunar: true },
    { personHandle: 'D12-001', personName: 'Nguyễn Duy Thâm', generation: 12, day: 6, month: 10, deathYear: 1953, isLunar: true },
    { personHandle: 'D08-001', personName: 'Nguyễn Duy Hoán', generation: 8, day: 4, month: 11, deathYear: 1821, isLunar: true },
    { personHandle: 'S_D12-002', personName: 'Nguyễn Thị Xa', generation: 12, day: 7, month: 11, deathYear: 1964, isLunar: false },
    { personHandle: 'D11-002', personName: 'Nguyễn Duy Sảng', generation: 11, day: 11, month: 11, deathYear: 1921, isLunar: true },
    { personHandle: 'D15-008', personName: 'Nguyễn Duy Hoàng Hải', generation: 15, day: 16, month: 11, deathYear: 2004, isLunar: true },
    { personHandle: 'D12-002', personName: 'Nguyễn Duy Hoạt', generation: 12, day: 25, month: 11, deathYear: 1932, isLunar: true },
    { personHandle: 'S_D13-005', personName: 'Nguyễn Thị Nhàn', generation: 13, day: 7, month: 12, deathYear: 2017, isLunar: false },
    { personHandle: 'S_D11-001', personName: 'Nguyễn Thị Viễn', generation: 11, day: 28, month: 12, isLunar: true },
];

export function getMockTreeData() {
    return { people: MOCK_PEOPLE, families: MOCK_FAMILIES };
}
