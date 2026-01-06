import React, { useState, useEffect } from 'react';
import { Form, FormConfig } from '../types';
import { X, Save, Eye, FileText, MapPin, Loader2, Upload, Trash2, CheckCircle2, Check } from 'lucide-react';
import { updateForm, getCompanyById } from '../utils/db';
import { uploadFileToDrive } from '../utils/googleDrive';

interface FormEditorModalProps {
    form: Form;
    companyId: string;
    onClose: () => void;
    onSave: (updatedForm: Form) => void;
    availableZones: string[];
}

export const FormEditorModal: React.FC<FormEditorModalProps> = ({
    form,
    companyId,
    onClose,
    onSave,
    availableZones
}) => {
    const [name, setName] = useState(form.name);
    const [config, setConfig] = useState<FormConfig>(form.config || {});
    const [activeTab, setActiveTab] = useState<'general' | 'documents' | 'apc' | 'zones'>('general');
    const [isSaving, setIsSaving] = useState(false);
    const [previewKey, setPreviewKey] = useState(0); // To force iframe refresh

    // Initialize config defaults if missing
    useEffect(() => {
        if (!config.requestedDocuments) {
            setConfig(prev => ({
                ...prev,
                requestedDocuments: {
                    idFile: true,
                    fichaFile: true,
                    talonarioFile: true,
                    signedAcpFile: true
                }
            }));
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const success = await updateForm(form.id, companyId, name, config);
            if (success) {
                onSave({ ...form, name, config });
                onClose();
            }
        } catch (error) {
            console.error('Error saving form:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const iframeUrl = `${window.location.origin}/?mode=embed&company_id=${companyId}&form_id=${form.id}`;

    // File Upload Logic for APC
    const [isUploading, setIsUploading] = useState(false);

    const handleApcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Solo se permiten archivos PDF');
            return;
        }

        setIsUploading(true);
        try {
            // First get credentials
            const company = await getCompanyById(companyId);
            if (!company?.googleDriveAccessToken || !company?.googleDriveFolderId) {
                alert('Debes conectar Google Drive en la Configuración General primero.');
                return;
            }

            // Upload file
            const result = await uploadFileToDrive(
                company.googleDriveAccessToken,
                file,
                company.googleDriveFolderId,
                `APC_DOC_FORM_${form.id}.pdf`
            );

            if (result && result.fileId) {
                setConfig(prev => ({ ...prev, apcDocumentId: result.fileId }));
            } else {
                alert('Error al subir el archivo a Google Drive');
            }
        } catch (error) {
            console.error('Error uploading APC:', error);
            alert('Error en la subida del archivo');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in transition-all">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[75vh] max-h-[850px] flex overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/20 relative">

                {/* Sidebar / Configuration Panel */}
                <div className="w-full md:w-1/3 border-r border-gray-100 flex flex-col bg-gray-50/50">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                        <h2 className="text-xl font-bold text-gray-900">Configurar Formulario</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Name Input */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Calculadora</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all bg-white"
                                placeholder="Nombre descriptivo"
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 p-1 bg-gray-200/50 rounded-xl">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'general' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                General
                            </button>
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'documents' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Docs
                            </button>
                            <button
                                onClick={() => setActiveTab('apc')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'apc' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                APC
                            </button>
                            <button
                                onClick={() => setActiveTab('zones')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'zones' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Zonas
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">

                            {/* General / Documents Tab (Sharing Logic for simplicity if needed, but separated here) */}

                            {activeTab === 'general' && (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-sm">Configuración general básica.</p>
                                </div>
                            )}

                            {activeTab === 'documents' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <FileText size={16} className="text-indigo-500" />
                                        Documentación Solicitada
                                    </h3>
                                    {[
                                        { key: 'idFile', label: 'Foto de Cédula / ID' },
                                        { key: 'fichaFile', label: 'Ficha de Seguro Social' },
                                        { key: 'talonarioFile', label: 'Talonario de Pago' },
                                        { key: 'signedAcpFile', label: 'Autorización APC Firmada' },
                                    ].map((doc) => (
                                        <div key={doc.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                            <span className="text-sm text-gray-700 font-medium">{doc.label}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={config.requestedDocuments?.[doc.key as keyof typeof config.requestedDocuments] ?? true}
                                                    onChange={(e) => {
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            requestedDocuments: {
                                                                ...prev.requestedDocuments,
                                                                [doc.key]: e.target.checked
                                                            } as any
                                                        }));
                                                        setPreviewKey(k => k + 1); // Refresh preview
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'apc' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <Upload size={16} className="text-indigo-500" />
                                        Documento APC Personalizado
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">Sube un documento APC específico para este formulario. Si no subes uno, se usará el definido en Configuración General.</p>

                                    {config.apcDocumentId ? (
                                        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
                                                <span className="text-sm font-medium text-indigo-700 truncate">Documento Configurado</span>
                                            </div>
                                            <button
                                                onClick={() => setConfig(prev => ({ ...prev, apcDocumentId: undefined }))}
                                                className="p-2 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                                            {isUploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                                                    <span className="text-sm text-gray-500">Subiendo...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                                                    <span className="text-sm text-gray-600 font-medium">Click para subir PDF</span>
                                                    <input
                                                        type="file"
                                                        accept="application/pdf"
                                                        onChange={handleApcUpload}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'zones' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <MapPin size={16} className="text-indigo-500" />
                                        Zonas Habilitadas
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">Selecciona qué zonas mostrar. Si no seleccionas ninguna, se mostrarán todas las de la empresa.</p>

                                    <div className="grid grid-cols-2 gap-2">
                                        {availableZones.map(zone => (
                                            <label key={zone} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${config.zones?.includes(zone)
                                                ? 'bg-indigo-50 border-indigo-200'
                                                : 'bg-white border-gray-200 hover:border-indigo-200'
                                                }`}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${config.zones?.includes(zone)
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'border-gray-300'
                                                    }`}>
                                                    {config.zones?.includes(zone) && <Check size={10} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={config.zones?.includes(zone) || false}
                                                    onChange={(e) => {
                                                        let newZones = config.zones || [];
                                                        if (e.target.checked) {
                                                            newZones = [...newZones, zone];
                                                        } else {
                                                            newZones = newZones.filter(z => z !== zone);
                                                        }
                                                        setConfig(prev => ({ ...prev, zones: newZones.length > 0 ? newZones : undefined }));
                                                        setPreviewKey(k => k + 1);
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-gray-700 truncate">{zone}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>

                    <div className="p-6 border-t border-gray-200 bg-white">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                            Guardar Cambios
                        </button>
                    </div>
                </div>

                {/* Live Preview */}
                <div className="hidden md:flex flex-1 bg-gray-100 flex-col relative">
                    <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-indigo-600 shadow-sm border border-indigo-50 flex items-center gap-2">
                        <Eye size={12} /> Live Preview
                    </div>

                    <div className="flex-1 p-8 flex items-center justify-center">
                        <div className="w-full max-w-[400px] h-full max-h-[850px] bg-white rounded-[40px] shadow-[0_50px_100px_-20px_rgba(50,50,93,0.25)] border-[8px] border-white overflow-hidden relative">
                            <iframe
                                key={previewKey} // Force reload on config change
                                src={iframeUrl}
                                className="w-full h-full bg-slate-50"
                                title="Preview"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
