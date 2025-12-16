
export interface Prospect {
    id: string;
    nombre: string;
    apellido?: string;
    telefono: string;
    empresa?: string;
    estado?: string;
    [key: string]: string | undefined; // For dynamic custom columns
}

export interface Template {
    content: string;
}

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'info' | 'error';
}
