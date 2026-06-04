import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MiniRue — Original Quality Perfumes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FDFBF5',
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: 'serif',
            fontSize: 64,
            fontWeight: 500,
            color: '#BB9452',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          MiniRue
        </div>
        <div
          style={{
            fontFamily: 'sans-serif',
            fontSize: 18,
            color: '#6B6560',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          Original Quality Perfumes
        </div>
      </div>
    ),
    { ...size },
  );
}
