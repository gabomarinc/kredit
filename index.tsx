import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KindeProvider } from '@kinde-oss/kinde-auth-react';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <KindeProvider
      clientId={import.meta.env.VITE_KINDE_CLIENT_ID}
      domain={import.meta.env.VITE_KINDE_DOMAIN}
      redirectUri={import.meta.env.VITE_KINDE_REDIRECT_URL}
      logoutUri={import.meta.env.VITE_KINDE_LOGOUT_REDIRECT_URL}
      isSSO={true}
    >
      <App />
    </KindeProvider>
  </StrictMode>
);