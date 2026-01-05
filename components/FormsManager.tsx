import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check, ExternalLink, Link as LinkIcon, Loader2 } from 'lucide-react';
import { createForm, getForms, deleteForm } from '../utils/db';
import { Form } from '../types';

interface FormsManagerProps {
    companyId: string;
}

export const FormsManager: React.FC<FormsManagerProps> = ({ companyId }) => {
    const [forms, setForms] = useState<Form[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newFormName, setNewFormName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        loadForms();
    }, [companyId]);

    const loadForms = async () => {
        setIsLoading(true);
        const data = await getForms(companyId);
        setForms(data);
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!newFormName.trim()) return;
        setIsCreating(true);
        try {
            const newForm = await createForm(companyId, newFormName.trim());
            if (newForm) {
                setForms([newForm, ...forms]);
                setNewFormName('');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este formulario? Los prospectos asociados perderán la referencia de origen.')) return;
        const success = await deleteForm(id, companyId);
        if (success) {
            setForms(forms.filter(f => f.id !== id));
        }
    };

    const getFormLink = (formId: string) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?mode=embed&company_id=${companyId}&form_id=${formId}`;
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy class', err);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/50 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Gestor de Formularios</h2>
                    <p className="text-gray-500 text-sm">Crea enlaces personalizados para identificar el origen de tus prospectos.</p>
                </div>
            </div>

            {/* Create New Form */}
            <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Nuevo Formulario</label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newFormName}
                        onChange={(e) => setNewFormName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                        placeholder="Ej: Campaña Instagram, Landing Page Navidad..."
                        className="flex-1 px-5 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white transition-all focus:shadow-sm"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newFormName.trim() || isCreating}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100"
                    >
                        {isCreating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                        <span className="hidden sm:inline">Crear</span>
                    </button>
                </div>
            </div>

            {/* Forms List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="text-indigo-500 animate-spin" />
                </div>
            ) : forms.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <LinkIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No has creado formularios personalizados aún.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {forms.map(form => {
                        const link = getFormLink(form.id);
                        const isCopied = copiedId === form.id;

                        return (
                            <div key={form.id} className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/50 transition-all duration-300">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-gray-900 truncate mb-1">{form.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <span>Creado el {new Date(form.createdAt).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-500">ID: ...{form.id.slice(-6)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex bg-gray-50 rounded-xl border border-gray-200 p-1 flex-1 sm:flex-none min-w-0">
                                            <input
                                                type="text"
                                                readOnly
                                                value={link}
                                                className="bg-transparent border-none text-xs text-gray-500 px-2 w-full sm:w-64 truncate outline-none"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(link, form.id)}
                                                className={`p-2 rounded-lg transition-all ${isCopied ? 'bg-green-100 text-green-600' : 'bg-white text-gray-500 hover:text-indigo-600 shadow-sm'}`}
                                                title="Copiar enlace"
                                            >
                                                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>

                                        <a
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                                            title="Abrir formulario"
                                        >
                                            <ExternalLink size={18} />
                                        </a>

                                        <button
                                            onClick={() => handleDelete(form.id)}
                                            className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                                            title="Eliminar formulario"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
