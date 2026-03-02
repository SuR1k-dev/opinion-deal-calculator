import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '24%',
                    background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 20,
                }}
            >
                O
            </div>
        ),
        {
            ...size,
        }
    );
}
