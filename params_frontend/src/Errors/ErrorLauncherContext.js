import { createContext } from 'react';

const ErrorLauncherContext = createContext({
    current: {
        triggerError: (msg) => {},
        capturingError: (f) => {
            return f;
        },
    }
});

export default ErrorLauncherContext;