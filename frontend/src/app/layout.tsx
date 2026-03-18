import type { Metadata } from 'next';
import { Inter, Noto_Serif, Crimson_Pro } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
});

const notoSerif = Noto_Serif({
  variable: '--font-serif',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
});

const crimsonPro = Crimson_Pro({
  variable: '--font-crimson',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Họ Nguyễn Duy (nhánh cụ Khoan Giản) - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình',
  description: 'Gia phả dòng họ Nguyễn Duy (nhánh cụ Khoan Giản) - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình — Quản lý gia phả & kết nối cộng đồng dòng họ',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSerif.variable} ${crimsonPro.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
