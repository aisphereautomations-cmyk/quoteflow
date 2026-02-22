'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuote } from './QuoteContext';

interface ClientData {
    clientName: string;
    email: string;
    whatsapp: string;
    serviceTitle: string;
}

interface ClientContextType {
    client: ClientData;
    updateClient: (updates: Partial<ClientData>) => void;
    clearClient: () => void;
}

const defaultClient: ClientData = {
    clientName: '',
    email: '',
    whatsapp: '',
    serviceTitle: '',
};

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
    const [client, setClient] = useState<ClientData>(defaultClient);
    const { currentQuoteId } = useQuote();

    // Clear client data when starting a new quote
    useEffect(() => {
        if (!currentQuoteId) {
            setClient(defaultClient);
        }
    }, [currentQuoteId]);

    const updateClient = (updates: Partial<ClientData>) => {
        setClient((prev) => ({ ...prev, ...updates }));
    };

    const clearClient = () => {
        setClient(defaultClient);
    };

    return (
        <ClientContext.Provider value={{ client, updateClient, clearClient }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClient() {
    const context = useContext(ClientContext);
    if (!context) {
        throw new Error('useClient must be used within a ClientProvider');
    }
    return context;
}
