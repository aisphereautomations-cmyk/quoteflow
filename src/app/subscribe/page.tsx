export default function SubscribePage() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1rem',
                padding: '2rem',
                background: '#000',
                color: '#fff',
                textAlign: 'center',
            }}
        >
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                Subscribe Screen
            </h1>
            <p style={{ color: '#a0a0a0', maxWidth: '500px' }}>
                This is a placeholder for the subscribe screen. Once you have the design
                ready, we'll implement it here!
            </p>
            <p style={{ color: '#a0a0a0', fontSize: '0.875rem', marginTop: '2rem' }}>
                This screen will allow users to subscribe or renew their subscription.
            </p>
        </div>
    );
}
