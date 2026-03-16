import './globals.css';

export const metadata = {
  title: '롯데웰푸드 AI 전환 과제 설계',
  description: 'AX 전략 구체화 워크숍 — 사전과제·세션1·2·3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
