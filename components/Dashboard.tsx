import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, DollarSign, LayoutDashboard, FileText, Download, Filter, Calendar, CheckCircle2, X, ChevronDown, MapPin, Briefcase, Settings, Plus, Trash2, Building, Image as ImageIcon, Shield, Save, Code, Copy, ExternalLink, Loader2, User, Target, MessageCircle, ShieldCheck, TrendingUp, Eye, FileText as FileTextIcon, BedDouble, Bath, Heart, ArrowRight, Upload, Check, ChevronLeft, RefreshCw, ChevronRight, Cloud, Calculator, FileCheck, Link as LinkIcon
} from 'lucide-react';
import { getProspectsFromDB, getCompanyById, updateCompanyZones, updateCompanyLogo, getPropertiesByCompany, saveProperty, updateProperty, deleteProperty, getPropertyInterestsByCompany, updateCompanyPlan, getPropertyInterestsByProspect, getProjectModelInterestsByProspect, saveProject, getProjectsByCompany, updateProject, deleteProject, updateCompanyName, getProspectDocuments, getPropertyImages, getProjectImages, updateCompanyGoogleDriveConfig, updateCompanyRequestedDocuments, updateCompanyApcDocument } from '../utils/db';
import { initiateGoogleDriveAuth, uploadFileToDrive, refreshAccessToken } from '../utils/googleDrive';
import { Prospect, Property, PropertyInterest, PlanType, Project, ProjectModel, Company } from '../types';
import { NotificationModal, NotificationType } from './ui/NotificationModal';
import { formatCurrency } from '../utils/calculator';
import * as XLSX from 'xlsx';
import { WhatsBlastTab } from './whatsblast/WhatsBlastTab';
import { FormsManager } from './FormsManager';

type Tab = 'dashboard' | 'prospects' | 'properties' | 'settings' | 'calculator-config' | 'campaigns' | 'forms';

interface DashboardProps {
  availableZones: string[];
  onUpdateZones: (zones: string[]) => void;
  companyName: string;
  onUpdateCompanyName: (name: string) => void;
}

// Componente Modal para Crear/Editar Propiedad
interface PropertyModalProps {
  property: Property | null;
  companyId: string;
  zones: string[];
  onClose: () => void;
  onSave: (property: Omit<Property, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => void;
}

const PropertyModal: React.FC<PropertyModalProps> = ({ property, zones, onClose, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(property?.title || '');
  const [description, setDescription] = useState(property?.description || '');
  const [type, setType] = useState<'Venta' | 'Alquiler'>(property?.type || 'Venta');
  const [price, setPrice] = useState(property?.price?.toString() || '');
  const [zone, setZone] = useState(property?.zone || zones[0] || '');
  const [bedrooms, setBedrooms] = useState(property?.bedrooms?.toString() || '');
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() || '');
  const [areaM2, setAreaM2] = useState(property?.areaM2?.toString() || '');
  const [images, setImages] = useState<string[]>(property?.images || []);
  const [address, setAddress] = useState(property?.address || '');
  const [status, setStatus] = useState<'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada'>(property?.status || 'Activa');
  const [highDemand, setHighDemand] = useState(property?.highDemand || false);
  const [demandVisits, setDemandVisits] = useState(property?.demandVisits?.toString() || '0');
  const [priceAdjusted, setPriceAdjusted] = useState(property?.priceAdjusted || false);
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState(property?.priceAdjustmentPercent?.toString() || '0');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setImages([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title,
        description,
        type,
        price: parseFloat(price) || 0,
        zone,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        areaM2: areaM2 ? parseFloat(areaM2) : null,
        images,
        address,
        features: [],
        status,
        highDemand,
        demandVisits: parseInt(demandVisits) || 0,
        priceAdjusted,
        priceAdjustmentPercent: parseFloat(priceAdjustmentPercent) || 0
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold text-gray-900">{property ? 'Editar Propiedad' : 'Nueva Propiedad'}</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
              placeholder="Ej: PH Santa Maria Court"
            />
          </div>

          {/* Tipo y Precio */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Venta' | 'Alquiler')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
              >
                <option value="Venta">Venta</option>
                <option value="Alquiler">Alquiler</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Precio *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Zona y Dirección */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zona *</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
              >
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
                placeholder="Dirección completa"
              />
            </div>
          </div>

          {/* Habitaciones, Baños, Área */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Habitaciones</label>
              <input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Baños</label>
              <input
                type="number"
                step="0.5"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
                placeholder="2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Área (m²)</label>
              <input
                type="number"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
                placeholder="120"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
              placeholder="Describe la propiedad..."
            />
          </div>

          {/* Imágenes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Imágenes</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
            />
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estado y Opciones */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Property['status'])}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none"
              >
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
                <option value="Vendida">Vendida</option>
                <option value="Alquilada">Alquilada</option>
              </select>
            </div>
          </div>

          {/* Opciones adicionales */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={highDemand}
                onChange={(e) => setHighDemand(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">Alta Demanda</span>
            </label>
            {highDemand && (
              <div className="ml-8">
                <label className="block text-sm text-gray-600 mb-1">Visitas esta semana</label>
                <input
                  type="number"
                  value={demandVisits}
                  onChange={(e) => setDemandVisits(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200"
                />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={priceAdjusted}
                onChange={(e) => setPriceAdjusted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">Precio Ajustado</span>
            </label>
            {priceAdjusted && (
              <div className="ml-8">
                <label className="block text-sm text-gray-600 mb-1">% bajo mercado</label>
                <input
                  type="number"
                  value={priceAdjustmentPercent}
                  onChange={(e) => setPriceAdjustmentPercent(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title || !price || !zone || isSaving}
              className="flex-1 px-6 py-3 rounded-xl text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #1fa890 0%, #1a8674 100%)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)'}
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {property ? 'Guardar Cambios' : 'Crear Propiedad'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente Modal para Crear/Editar Proyecto (Paso a Paso) - Promotora
interface ProjectModalProps {
  project?: Project | null;
  companyId: string;
  zones: string[];
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, zones, onClose, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [zone, setZone] = useState(project?.zone || zones[0] || '');
  const [address, setAddress] = useState(project?.address || '');
  const [projectImages, setProjectImages] = useState<string[]>(project?.images || []);
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(project?.status || 'Activo');
  const [models, setModels] = useState<ProjectModel[]>(project?.models || []);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<ProjectModel>({
    name: '',
    areaM2: null,
    bedrooms: null,
    bathrooms: null,
    amenities: [],
    unitsTotal: 0,
    unitsAvailable: 0,
    price: 0,
    images: []
  });
  const [newAmenity, setNewAmenity] = useState('');

  // Amenidades predefinidas
  const predefinedAmenities = ['Gym', 'Piscina', 'Terraza', 'Padel'];

  const handleProjectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setProjectImages([...projectImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newImages.push(base64);
        if (newImages.length === files.length) {
          setCurrentModel({ ...currentModel, images: [...currentModel.images, ...newImages] });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addModel = () => {
    if (!currentModel.name || currentModel.unitsTotal === 0 || currentModel.price === 0) {
      return;
    }

    if (editingModelIndex !== null) {
      // Actualizar modelo existente
      const updatedModels = [...models];
      updatedModels[editingModelIndex] = { ...currentModel };
      setModels(updatedModels);
      setEditingModelIndex(null);
    } else {
      // Agregar nuevo modelo
      setModels([...models, { ...currentModel }]);
    }

    // Limpiar formulario
    setCurrentModel({
      name: '',
      areaM2: null,
      bedrooms: null,
      bathrooms: null,
      amenities: [],
      unitsTotal: 0,
      unitsAvailable: 0,
      price: 0,
      images: []
    });
    setNewAmenity('');
  };

  const editModel = (index: number) => {
    const modelToEdit = models[index];
    setCurrentModel({ ...modelToEdit });
    setEditingModelIndex(index);
    // Scroll al formulario de modelo
    const formElement = document.querySelector('[data-model-form]');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const cancelEdit = () => {
    setEditingModelIndex(null);
    setCurrentModel({
      name: '',
      areaM2: null,
      bedrooms: null,
      bathrooms: null,
      amenities: [],
      unitsTotal: 0,
      unitsAvailable: 0,
      price: 0,
      images: []
    });
    setNewAmenity('');
  };

  const removeModel = (index: number) => {
    if (editingModelIndex === index) {
      // Si se elimina el modelo que se está editando, cancelar edición
      cancelEdit();
    }
    setModels(models.filter((_, i) => i !== index));
  };

  const addAmenity = (amenity?: string) => {
    const amenityToAdd = amenity || newAmenity.trim();
    if (amenityToAdd && !currentModel.amenities?.includes(amenityToAdd)) {
      setCurrentModel({
        ...currentModel,
        amenities: [...(currentModel.amenities || []), amenityToAdd]
      });
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity: string) => {
    setCurrentModel({
      ...currentModel,
      amenities: currentModel.amenities?.filter(a => a !== amenity) || []
    });
  };

  const handleSave = async () => {
    if (!name || !zone || models.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        companyId: '',
        name,
        description,
        zone,
        address,
        images: projectImages,
        status,
        models
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{project ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
            <div className="flex gap-2 mt-2">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${idx + 1 <= step ? 'bg-primary-600 w-8' : 'bg-gray-200 w-2'
                    }`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* PASO 1: Información Básica del Proyecto */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Información del Proyecto</h2>
                <p className="text-gray-500">Completa los datos básicos de tu proyecto</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building size={16} className="text-primary-500" />
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white transition-all focus:shadow-sm"
                  placeholder="Ej: Edificio Residencial Los Pinos"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-primary-500 outline-none resize-none"
                  rows={4}
                  placeholder="Describe el proyecto..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-primary-500" />
                  Zona *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {zones.map(z => (
                    <button
                      key={z}
                      onClick={() => setZone(z)}
                      className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 border flex items-center justify-center ${zone === z
                        ? 'text-white border-primary-600 shadow-md transform scale-[1.02]'
                        : 'bg-white text-gray-500 border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-600'
                        }`}
                    >
                      {zone === z && <Check size={14} className="mr-2" />}
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white transition-all focus:shadow-sm"
                  placeholder="Dirección completa"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4">Estado *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setStatus('Activo')}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${status === 'Activo'
                      ? 'border-green-500 bg-green-50 shadow-lg scale-[1.02]'
                      : 'border-gray-100 bg-white hover:border-green-200 hover:shadow-md'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${status === 'Activo' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Activo</h4>
                    <p className="text-sm text-gray-500">Proyecto disponible</p>
                  </button>
                  <button
                    onClick={() => setStatus('Inactivo')}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${status === 'Inactivo'
                      ? 'border-gray-400 bg-gray-50 shadow-lg scale-[1.02]'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${status === 'Inactivo' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <X size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Inactivo</h4>
                    <p className="text-sm text-gray-500">Proyecto pausado</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-primary-500" />
                  Imágenes del Proyecto
                </label>
                <label className="block w-full px-5 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer text-center">
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <span className="text-sm text-gray-600">Haz clic para subir imágenes</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleProjectImageUpload}
                    className="hidden"
                  />
                </label>
                {projectImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {projectImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Proyecto ${idx + 1}`} className="w-full h-24 object-cover rounded-xl" />
                        <button
                          onClick={() => setProjectImages(projectImages.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASO 2: Agregar Modelos */}
          {step === 2 && (
            <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Agregar Modelos</h2>
                <p className="text-gray-500">Define los modelos disponibles en tu proyecto</p>
              </div>

              {/* Formulario de Modelo Actual */}
              <div className="bg-gray-50/50 p-8 rounded-2xl border border-gray-100 space-y-6" data-model-form>
                {editingModelIndex !== null && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings size={18} className="text-primary-600" />
                      <span className="text-sm font-semibold text-primary-900">Editando modelo: {models[editingModelIndex]?.name}</span>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Building size={16} className="text-primary-500" />
                    Nombre del Modelo *
                  </label>
                  <input
                    type="text"
                    value={currentModel.name}
                    onChange={(e) => setCurrentModel({ ...currentModel, name: e.target.value })}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white transition-all focus:shadow-sm"
                    placeholder="Ej: Modelo A - 2BR"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign size={16} className="text-primary-500" />
                    Precio *
                  </label>
                  <input
                    type="number"
                    value={currentModel.price || ''}
                    onChange={(e) => setCurrentModel({ ...currentModel, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white transition-all focus:shadow-sm"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Target size={14} className="text-gray-400" />
                      Área (m²)
                    </label>
                    <input
                      type="number"
                      value={currentModel.areaM2 || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, areaM2: parseFloat(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <BedDouble size={14} className="text-gray-400" />
                      Habitaciones
                    </label>
                    <input
                      type="number"
                      value={currentModel.bedrooms || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, bedrooms: parseInt(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Bath size={14} className="text-gray-400" />
                      Baños
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentModel.bathrooms || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, bathrooms: parseFloat(e.target.value) || null })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      Unidades *
                    </label>
                    <input
                      type="number"
                      value={currentModel.unitsTotal || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, unitsTotal: parseInt(e.target.value) || 0, unitsAvailable: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-primary-500" />
                    Amenidades
                  </label>

                  {/* Amenidades Predefinidas */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Amenidades Predefinidas</p>
                    <div className="flex flex-wrap gap-2">
                      {predefinedAmenities.map((amenity) => {
                        const isAdded = currentModel.amenities?.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => {
                              if (isAdded) {
                                removeAmenity(amenity);
                              } else {
                                addAmenity(amenity);
                              }
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isAdded
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                              }`}
                          >
                            {isAdded ? (
                              <span className="flex items-center gap-1.5">
                                <Check size={14} />
                                {amenity}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <Plus size={14} />
                                {amenity}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Agregar Amenidad Personalizada */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Agregar Amenidad Personalizada</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAmenity}
                        onChange={(e) => setNewAmenity(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAmenity()}
                        className="flex-1 px-5 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-white"
                        placeholder="Ej: Salón de eventos, Cancha de tenis..."
                      />
                      <button
                        type="button"
                        onClick={() => addAmenity()}
                        disabled={!newAmenity.trim()}
                        className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Amenidades Agregadas */}
                  {currentModel.amenities && currentModel.amenities.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 font-medium">Amenidades Agregadas ({currentModel.amenities.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {currentModel.amenities.map((amenity, idx) => (
                          <span
                            key={idx}
                            className="px-4 py-2 bg-indigo-100 text-primary-700 rounded-full text-sm font-medium flex items-center gap-2"
                          >
                            {amenity}
                            <button
                              type="button"
                              onClick={() => removeAmenity(amenity)}
                              className="text-primary-500 hover:text-primary-700 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary-500" />
                    Imágenes del Modelo
                  </label>
                  <label className="block w-full px-5 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer text-center">
                    <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-600">Haz clic para subir imágenes</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleModelImageUpload}
                      className="hidden"
                    />
                  </label>
                  {currentModel.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      {currentModel.images.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt={`Modelo ${idx + 1}`} className="w-full h-24 object-cover rounded-xl" />
                          <button
                            onClick={() => setCurrentModel({ ...currentModel, images: currentModel.images.filter((_, i) => i !== idx) })}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={addModel}
                  disabled={!currentModel.name || currentModel.unitsTotal === 0 || currentModel.price === 0}
                  className="w-full px-6 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200"
                >
                  {editingModelIndex !== null ? (
                    <>
                      <Save size={20} className="inline mr-2" />
                      Actualizar Modelo
                    </>
                  ) : (
                    <>
                      <Plus size={20} className="inline mr-2" />
                      Agregar Modelo
                    </>
                  )}
                </button>
              </div>

              {/* Lista de Modelos Agregados */}
              {models.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-semibold text-gray-700">Modelos Agregados ({models.length})</h5>
                  {models.map((model, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{model.name}</p>
                        <p className="text-sm text-gray-500">
                          {model.areaM2 ? `${model.areaM2}m² • ` : ''}
                          {model.bedrooms ? `${model.bedrooms} BR • ` : ''}
                          {model.bathrooms ? `${model.bathrooms} BA • ` : ''}
                          {formatCurrency(model.price)} • {model.unitsAvailable}/{model.unitsTotal} disponibles
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => editModel(idx)}
                          className="px-3 py-1 bg-indigo-100 text-primary-600 rounded-lg hover:bg-primary-200 font-semibold text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeModel(idx)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-semibold text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: Revisar y Guardar */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Revisar Información</h4>

              <div className="bg-gray-50 p-6 rounded-xl space-y-4">
                <div>
                  <h5 className="font-semibold text-gray-700 mb-2">Información del Proyecto</h5>
                  <p><strong>Nombre:</strong> {name}</p>
                  <p><strong>Zona:</strong> {zone}</p>
                  {address && <p><strong>Dirección:</strong> {address}</p>}
                  {description && <p><strong>Descripción:</strong> {description}</p>}
                  <p><strong>Estado:</strong> {status}</p>
                  {projectImages.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold mb-2">Imágenes ({projectImages.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {projectImages.map((img, idx) => (
                          <img key={idx} src={img} alt={`Proyecto ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-semibold text-gray-700 mb-2">Modelos ({models.length})</h5>
                  {models.map((model, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg mb-2">
                      <p className="font-semibold">{model.name}</p>
                      <p className="text-sm text-gray-600">
                        {model.areaM2 ? `${model.areaM2}m² • ` : ''}
                        {model.bedrooms ? `${model.bedrooms} BR • ` : ''}
                        {model.bathrooms ? `${model.bathrooms} BA • ` : ''}
                        Precio: {formatCurrency(model.price)} • {model.unitsAvailable}/{model.unitsTotal} disponibles
                      </p>
                      {model.amenities && model.amenities.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">Amenidades: {model.amenities.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navegación */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 py-3 sm:py-0 order-2 sm:order-1"
              >
                <ChevronLeft size={20} /> Atrás
              </button>
            ) : (
              <div></div>
            )}
            {step < totalSteps ? (
              <button
                onClick={() => {
                  if (step === 1 && !name) return;
                  if (step === 2 && models.length === 0) return;
                  setStep(step + 1);
                }}
                disabled={(step === 1 && !name) || (step === 2 && models.length === 0)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl order-1 sm:order-2 w-full sm:w-auto ${(step === 1 && name) || (step === 2 && models.length > 0)
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
              >
                Continuar <ArrowRight size={20} className="shrink-0" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!name || !zone || models.length === 0 || isSaving}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl order-1 sm:order-2 w-full sm:w-auto ${name && zone && models.length > 0 && !isSaving
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={20} className="animate-spin shrink-0" />
                    Guardando...
                  </>
                ) : (
                  <>
                    Guardar Proyecto <Check size={20} className="shrink-0" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ availableZones, onUpdateZones, companyName, onUpdateCompanyName }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);
  const [settingsSubmenuTimeout, setSettingsSubmenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; url: string; name: string } | null>(null);
  const [newZone, setNewZone] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSavingCompanyName, setIsSavingCompanyName] = useState(false);
  const [loadingProspectDocuments, setLoadingProspectDocuments] = useState(false);
  const [prospectDocumentsLoaded, setProspectDocumentsLoaded] = useState(false);

  // Export Modal State
  const [exportFilterType, setExportFilterType] = useState<'all' | 'dateRange'>('all');
  const [exportSalaryRange, setExportSalaryRange] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // DB Data State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Properties State
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyInterests, setPropertyInterests] = useState<PropertyInterest[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [selectedPropertyForEdit, setSelectedPropertyForEdit] = useState<Property | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showPropertySelectionModal, setShowPropertySelectionModal] = useState(false);
  const [prospectInterestedProperties, setProspectInterestedProperties] = useState<Property[]>([]);
  const [isLoadingProspectProperties, setIsLoadingProspectProperties] = useState(false);
  const [prospectInterestedModels, setProspectInterestedModels] = useState<Array<{ model: ProjectModel; project: Project }>>([]);
  const [isLoadingProspectModels, setIsLoadingProspectModels] = useState(false);

  // Projects State (Promotora)
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null);
  const [showProjectSelectionModal, setShowProjectSelectionModal] = useState(false);

  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; message: string; title?: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });

  // Settings State - Cargar desde DB
  const [adminName, setAdminName] = useState('Admin Gerente');
  const [adminEmail, setAdminEmail] = useState('gerencia@kredit.com');
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [isPromotora, setIsPromotora] = useState<boolean>(false); // Inicializar como false para que no aparezca el cuadro
  const [isSavingZones, setIsSavingZones] = useState(false);

  // Estados para Configurar Calculadora
  const [requestedDocuments, setRequestedDocuments] = useState<{
    idFile: boolean;
    fichaFile: boolean;
    talonarioFile: boolean;
    signedAcpFile: boolean;
  }>({
    idFile: true,
    fichaFile: true,
    talonarioFile: true,
    signedAcpFile: true
  });
  const [isSavingDocuments, setIsSavingDocuments] = useState(false);
  const [apcDocumentFile, setApcDocumentFile] = useState<File | null>(null);
  const [isUploadingApcDocument, setIsUploadingApcDocument] = useState(false);

  // Estado derivado para Google Drive en configuración
  const isGoogleDriveConnected = !!(companyData?.googleDriveFolderId && companyData.googleDriveAccessToken && companyData.googleDriveRefreshToken);

  // Función para cargar prospectos (reutilizable) con caché
  const loadProspects = async (forceRefresh: boolean = false) => {
    // Obtener companyId para filtrar prospectos y usar en caché
    const companyId = localStorage.getItem('companyId');
    const cacheKey = `prospects_cache_${companyId || 'no_company'}`;
    const cacheTime = 2 * 60 * 1000; // 2 minutos (reducido de 5)

    // Si es refresh forzado, limpiar caché
    if (forceRefresh) {
      try {
        localStorage.removeItem(cacheKey);
        console.log('🔄 Caché de prospectos limpiado para refresh forzado');
      } catch (e) {
        console.warn('⚠️ Error limpiando caché:', e);
      }
    }

    // Verificar caché si no es refresh forzado
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            console.log('✅ Usando prospectos desde caché para companyId:', companyId);
            setProspects(data);
            setCurrentPage(1);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Error leyendo caché de prospectos:', e);
      }
    }

    try {
      setIsRefreshing(true);
      console.log('🔄 Cargando prospectos desde BD para companyId:', companyId);
      const data = await getProspectsFromDB(companyId || undefined);
      setProspects(data);
      console.log('✅ Prospectos cargados:', data.length, 'para companyId:', companyId);

      // Guardar en caché
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        console.log('✅ Prospectos guardados en caché');
      } catch (e) {
        console.warn('⚠️ Error guardando en caché:', e);
      }

      // Resetear a la primera página cuando se cargan nuevos datos
      setCurrentPage(1);
    } catch (error) {
      console.error('❌ Error cargando prospectos:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshProspects = async () => {
    await loadProspects(true);
    setNotification({
      isOpen: true,
      type: 'success',
      message: 'Prospectos actualizados correctamente.',
      title: 'Actualizado'
    });
  };

  // Calcular prospectos paginados
  // Filtrar prospectos
  const filteredProspects = prospects.filter(prospect => {
    // Filtro por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesName = prospect.name.toLowerCase().includes(searchLower);
      const matchesEmail = prospect.email.toLowerCase().includes(searchLower);
      const matchesPhone = prospect.phone?.toLowerCase().includes(searchLower) || false;

      if (!matchesName && !matchesEmail && !matchesPhone) {
        return false;
      }
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      const prospectStatus = prospect.status?.toLowerCase() || 'new';
      if (statusFilter === 'new' && prospectStatus !== 'new') return false;
      if (statusFilter === 'contacted' && prospectStatus !== 'contacted') return false;
      if (statusFilter === 'qualified' && prospectStatus !== 'qualified') return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredProspects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProspects = filteredProspects.slice(startIndex, endIndex);

  // Refrescar prospectos cuando se cambia a la pestaña de prospectos
  useEffect(() => {
    if (activeTab === 'prospects') {
      // Refrescar automáticamente al entrar a la pestaña (con caché si está disponible)
      loadProspects(false);
    }
  }, [activeTab]);

  // Load Data from Neon
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Cargar prospectos
        await loadProspects();

        // Cargar datos de la empresa
        const companyId = localStorage.getItem('companyId');
        if (companyId) {
          const company = await getCompanyById(companyId);
          if (company) {
            console.log('📋 Datos de empresa cargados:', {
              id: company.id,
              name: company.name,
              email: company.email,
              hasLogo: !!company.logoUrl,
              logoUrlType: company.logoUrl ? (company.logoUrl.startsWith('data:') ? 'base64' : company.logoUrl.startsWith('blob:') ? 'blob' : 'url') : 'none',
              logoUrlPreview: company.logoUrl ? company.logoUrl.substring(0, 50) + '...' : 'none'
            });
            setCompanyData(company);
            setIsPromotora(company.role === 'Promotora'); // Establecer inmediatamente
            setAdminName(company.name);
            setAdminEmail(company.email);
            setLogoError(false); // Reset logo error cuando se carga nueva empresa
            // Actualizar zonas si vienen de la DB
            if (company.zones.length > 0) {
              onUpdateZones(company.zones);
            }
            // Cargar configuración de documentos solicitados
            if (company.requestedDocuments) {
              setRequestedDocuments(company.requestedDocuments);
            }
          }
        }
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []); // Run once on mount

  // Cerrar submenú cuando se cambia a un tab que no es de configuración
  useEffect(() => {
    if (activeTab !== 'settings' && activeTab !== 'calculator-config') {
      setShowSettingsSubmenu(false);
    }
  }, [activeTab]);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Manejar callback de OAuth de Google Drive cuando venimos desde la configuración
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleDriveAuth = urlParams.get('google_drive_auth');

    if (googleDriveAuth === 'success') {
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const folderId = urlParams.get('folder_id');
      const companyId = localStorage.getItem('companyId');

      if (accessToken && refreshToken && companyId) {
        (async () => {
          try {
            const updated = await updateCompanyGoogleDriveConfig(companyId, accessToken, refreshToken, folderId || undefined);
            if (updated) {
              // Recargar datos de la empresa para reflejar el estado conectado
              const company = await getCompanyById(companyId);
              if (company) {
                setCompanyData(company);
              }

              setNotification({
                isOpen: true,
                type: 'success',
                message: 'Google Drive conectado exitosamente. Tus documentos se guardarán automáticamente.',
                title: 'Integración actualizada'
              });
            } else {
              setNotification({
                isOpen: true,
                type: 'error',
                message: 'No se pudo guardar la configuración de Google Drive. Intenta nuevamente.',
                title: 'Error guardando configuración'
              });
            }
          } catch (error) {
            console.error('❌ Error manejando callback de Google Drive en Dashboard:', error);
            setNotification({
              isOpen: true,
              type: 'error',
              message: 'Ocurrió un error al conectar con Google Drive. Intenta nuevamente.',
              title: 'Error de conexión'
            });
          } finally {
            // Limpiar parámetros de la URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('google_drive_auth');
            newUrl.searchParams.delete('access_token');
            newUrl.searchParams.delete('refresh_token');
            newUrl.searchParams.delete('folder_id');
            window.history.replaceState({}, '', newUrl.toString());
          }
        })();
      }
    }
  }, []);

  // Función para cargar propiedades con caché
  const loadProperties = async (forceRefresh: boolean = false) => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) return;

    const cacheKey = `properties_cache_${companyId}`;
    const cacheTime = 5 * 60 * 1000; // 5 minutos

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            console.log('✅ Usando propiedades desde caché');
            setProperties(data);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Error leyendo caché de propiedades:', e);
      }
    }

    try {
      console.log('🔄 Cargando propiedades desde BD...');
      const props = await getPropertiesByCompany(companyId);
      setProperties(props);
      console.log('✅ Propiedades cargadas:', props.length);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: props,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('⚠️ Error guardando en caché:', e);
      }
    } catch (e) {
      console.error("Error loading properties:", e);
    }
  };

  // Función para cargar proyectos con caché
  const loadProjects = async (forceRefresh: boolean = false) => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) return;

    const cacheKey = `projects_cache_${companyId}`;
    const cacheTime = 5 * 60 * 1000; // 5 minutos

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            console.log('✅ Usando proyectos desde caché');
            setProjects(data);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Error leyendo caché de proyectos:', e);
      }
    }

    try {
      console.log('🔄 Cargando proyectos desde BD...');
      const projs = await getProjectsByCompany(companyId);
      setProjects(projs);
      console.log('✅ Proyectos cargados:', projs.length);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: projs,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('⚠️ Error guardando en caché:', e);
      }
    } catch (e) {
      console.error("Error loading projects:", e);
    }
  };

  // Load Properties/Projects when tab changes to properties
  useEffect(() => {
    const loadData = async () => {
      if (activeTab === 'properties') {
        setIsLoadingProperties(true);
        try {
          if (isPromotora) {
            await loadProjects();
          } else {
            await loadProperties();
            // Also load property interests
            const companyId = localStorage.getItem('companyId');
            if (companyId) {
              const interests = await getPropertyInterestsByCompany(companyId);
              setPropertyInterests(interests);
            }
          }
        } catch (e) {
          console.error("Error loading data:", e);
        } finally {
          setIsLoadingProperties(false);
        }
      }
    };
    loadData();
  }, [activeTab, isPromotora]);

  // Función para importar propiedades desde Excel/CSV
  const handleImportProperties = async (file: File) => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'No se encontró el ID de la empresa. Por favor, inicia sesión nuevamente.',
        title: 'Error de sesión'
      });
      return;
    }

    try {
      setIsLoadingProperties(true);

      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let importedData: any[] = [];

      if (fileExtension === 'csv') {
        // Leer CSV
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        importedData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v));
      } else {
        // Leer Excel usando XLSX
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        importedData = XLSX.utils.sheet_to_json(firstSheet);
      }

      if (importedData.length === 0) {
        setNotification({
          isOpen: true,
          type: 'warning',
          message: 'El archivo no contiene datos válidos.',
          title: 'Archivo vacío'
        });
        setIsLoadingProperties(false);
        return;
      }

      // Mapear datos importados a propiedades
      let successCount = 0;
      let errorCount = 0;

      for (const row of importedData) {
        try {
          // Mapear columnas comunes (flexible)
          const propertyData = {
            companyId,
            title: row['Título'] || row['Title'] || row['Nombre'] || row['title'] || row['nombre'] || 'Propiedad sin título',
            description: row['Descripción'] || row['Description'] || row['description'] || row['descripcion'] || '',
            type: (row['Tipo'] || row['Type'] || row['type'] || 'Venta') as 'Venta' | 'Alquiler',
            price: parseFloat(row['Precio'] || row['Price'] || row['price'] || row['Precio'] || '0') || 0,
            zone: row['Zona'] || row['Zone'] || row['zone'] || availableZones[0] || '',
            bedrooms: row['Habitaciones'] || row['Bedrooms'] || row['bedrooms'] || row['Habitaciones'] ? parseInt(row['Habitaciones'] || row['Bedrooms'] || row['bedrooms']) : null,
            bathrooms: row['Baños'] || row['Bathrooms'] || row['bathrooms'] || row['Baños'] ? parseFloat(row['Baños'] || row['Bathrooms'] || row['bathrooms']) : null,
            areaM2: row['Área'] || row['Area'] || row['area'] || row['m2'] || row['Área'] ? parseFloat(row['Área'] || row['Area'] || row['area'] || row['m2']) : null,
            images: [],
            address: row['Dirección'] || row['Address'] || row['address'] || row['Dirección'] || '',
            features: [],
            status: 'Activa' as Property['status'],
            highDemand: false,
            demandVisits: 0,
            priceAdjusted: false,
            priceAdjustmentPercent: 0
          };

          if (propertyData.price > 0 && propertyData.zone) {
            await saveProperty(propertyData);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error importando propiedad:', error);
          errorCount++;
        }
      }

      // Recargar propiedades (invalidar caché)
      await loadProperties(true);

      setIsLoadingProperties(false);

      setNotification({
        isOpen: true,
        type: successCount > 0 ? 'success' : 'error',
        message: successCount > 0
          ? `Se importaron ${successCount} propiedades exitosamente${errorCount > 0 ? `. ${errorCount} propiedades tuvieron errores.` : '.'}`
          : `No se pudieron importar las propiedades. Verifica el formato del archivo.`,
        title: successCount > 0 ? 'Importación exitosa' : 'Error en importación'
      });

    } catch (error) {
      console.error('Error importando propiedades:', error);
      setIsLoadingProperties(false);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al importar el archivo. Verifica que sea un Excel o CSV válido.',
        title: 'Error de importación'
      });
    }
  };

  // Load properties for selected prospect
  useEffect(() => {
    const loadProspectData = async () => {
      if (selectedProspect) {
        // Solo cargar documentos si aún no se han cargado (evitar loop infinito)
        if (!prospectDocumentsLoaded && !loadingProspectDocuments) {
          setIsLoadingProspectProperties(true);
          setProspectDocumentsLoaded(false);

          // Cargar documentos Base64 bajo demanda (lazy loading)
          setLoadingProspectDocuments(true);
          try {
            console.log('🔄 Cargando documentos del prospecto:', selectedProspect.id);
            const documents = await getProspectDocuments(selectedProspect.id);
            console.log('✅ Documentos cargados:', {
              hasIdFile: !!(documents.idFileBase64 || documents.idFileDriveUrl),
              hasFichaFile: !!(documents.fichaFileBase64 || documents.fichaFileDriveUrl),
              hasTalonarioFile: !!(documents.talonarioFileBase64 || documents.talonarioFileDriveUrl),
              hasSignedAcpFile: !!(documents.signedAcpFileBase64 || documents.signedAcpFileDriveUrl),
              usingDrive: !!(documents.idFileDriveUrl || documents.fichaFileDriveUrl || documents.talonarioFileDriveUrl || documents.signedAcpFileDriveUrl)
            });
            setSelectedProspect(prev => prev ? {
              ...prev,
              // Priorizar Base64 (descargado) para poder mostrar inline; usar URL de Drive solo como fallback
              idFileBase64: documents.idFileBase64 || documents.idFileDriveUrl || null,
              fichaFileBase64: documents.fichaFileBase64 || documents.fichaFileDriveUrl || null,
              talonarioFileBase64: documents.talonarioFileBase64 || documents.talonarioFileDriveUrl || null,
              signedAcpFileBase64: documents.signedAcpFileBase64 || documents.signedAcpFileDriveUrl || null
            } : null);
            setProspectDocumentsLoaded(true);
          } catch (e) {
            console.error("❌ Error loading prospect documents:", e);
          } finally {
            setLoadingProspectDocuments(false);
          }
        }

        // Cargar propiedades de interés (Broker)
        if (!isPromotora) {
          setIsLoadingProspectProperties(true);
          try {
            const props = await getPropertyInterestsByProspect(selectedProspect.id);
            setProspectInterestedProperties(props);
          } catch (e) {
            console.error("Error loading prospect properties:", e);
          } finally {
            setIsLoadingProspectProperties(false);
          }
        }

        // Cargar modelos de proyectos de interés (Promotora)
        if (isPromotora) {
          setIsLoadingProspectModels(true);
          try {
            const models = await getProjectModelInterestsByProspect(selectedProspect.id);
            setProspectInterestedModels(models);
          } catch (e) {
            console.error("Error loading prospect project models:", e);
          } finally {
            setIsLoadingProspectModels(false);
          }
        }
      } else {
        setProspectInterestedProperties([]);
        setProspectInterestedModels([]);
        setProspectDocumentsLoaded(false);
      }
    };
    loadProspectData();
  }, [selectedProspect?.id]); // Solo depender del ID, no del objeto completo

  // Cerrar submenú cuando cambia el tab activo (excepto si es settings o calculator-config)
  useEffect(() => {
    if (activeTab !== 'settings' && activeTab !== 'calculator-config') {
      setShowSettingsSubmenu(false);
    }
  }, [activeTab]);

  // Cleanup del timeout al desmontar
  useEffect(() => {
    return () => {
      if (settingsSubmenuTimeout) {
        clearTimeout(settingsSubmenuTimeout);
      }
    };
  }, [settingsSubmenuTimeout]);

  // Calculate KPIs based on REAL prospects
  const totalForms = prospects.length;
  // Explicitly type accumulator as number to avoid TS arithmetic errors
  const totalIncome = prospects.reduce((acc: number, curr) => acc + (curr.income || 0), 0);
  const avgSalary = totalForms > 0 ? totalIncome / totalForms : 0;

  // Explicitly type accumulator as number
  const totalCapacity = prospects.reduce((acc: number, curr) => acc + (Number(curr.result?.maxPropertyPrice) || 0), 0);
  const avgCapacity = totalForms > 0 ? totalCapacity / totalForms : 0;

  // Calculate most popular zone
  // Calcular conteo de zonas (soporta arrays y strings)
  const zoneCounts = prospects.reduce((acc, curr) => {
    if (Array.isArray(curr.zone)) {
      curr.zone.forEach(z => {
        const zoneName = z || 'Sin zona';
        acc[zoneName] = (acc[zoneName] || 0) + 1;
      });
    } else {
      const z = curr.zone || 'Sin zona';
      acc[z] = (acc[z] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedZones = Object.entries(zoneCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const topZone = sortedZones[0]?.[0] || 'Aún no tenemos datos';
  const topZoneCount = sortedZones[0]?.[1] || 0;

  // Preparar las primeras 2 zonas para mostrar
  const topTwoZones = sortedZones.slice(0, 2).map(([zone]) => zone);
  const hasMoreZones = sortedZones.length > 2;
  const totalZones = sortedZones.length;

  const handleAddZone = async () => {
    if (newZone.trim() && !availableZones.includes(newZone.trim())) {
      setIsSavingZones(true);
      const updatedZones = [...availableZones, newZone.trim()];
      onUpdateZones(updatedZones);
      setNewZone('');

      // Guardar en la base de datos
      const companyId = localStorage.getItem('companyId');
      if (companyId) {
        try {
          const success = await updateCompanyZones(companyId, updatedZones);
          if (success) {
            console.log('✅ Zona agregada y guardada en la base de datos');
          } else {
            console.error('❌ Error al guardar zona en la base de datos');
          }
        } finally {
          setIsSavingZones(false);
        }
      } else {
        setIsSavingZones(false);
      }
    }
  };

  const handleDeleteZone = async (zoneToDelete: string) => {
    const updatedZones = availableZones.filter(z => z !== zoneToDelete);
    onUpdateZones(updatedZones);

    // Guardar en la base de datos
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      const success = await updateCompanyZones(companyId, updatedZones);
      if (success) {
        console.log('✅ Zona eliminada y actualizada en la base de datos');
      } else {
        console.error('❌ Error al actualizar zonas en la base de datos');
      }
    }
  };

  // Guardar configuración de documentos solicitados
  const handleSaveRequestedDocuments = async () => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) return;

    setIsSavingDocuments(true);
    try {
      const success = await updateCompanyRequestedDocuments(companyId, requestedDocuments);
      if (success) {
        setNotification({
          isOpen: true,
          type: 'success',
          message: 'Configuración de documentos actualizada exitosamente.',
          title: 'Actualizado'
        });
        // Actualizar companyData
        if (companyData) {
          setCompanyData({ ...companyData, requestedDocuments });
        }
      } else {
        setNotification({
          isOpen: true,
          type: 'error',
          message: 'Error al guardar la configuración de documentos.',
          title: 'Error'
        });
      }
    } catch (error) {
      console.error('Error guardando documentos solicitados:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al guardar la configuración de documentos.',
        title: 'Error'
      });
    } finally {
      setIsSavingDocuments(false);
    }
  };

  // Subir documento APC a Google Drive
  const handleUploadApcDocument = async () => {
    if (!apcDocumentFile) return;

    const companyId = localStorage.getItem('companyId');
    if (!companyId || !companyData) {
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'No se encontró la información de la empresa.',
        title: 'Error'
      });
      return;
    }

    if (!isGoogleDriveConnected) {
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'Debes conectar Google Drive primero para subir documentos.',
        title: 'Google Drive no conectado'
      });
      return;
    }

    setIsUploadingApcDocument(true);
    try {
      let accessToken = companyData.googleDriveAccessToken!;
      const refreshToken = companyData.googleDriveRefreshToken!;
      const folderId = companyData.googleDriveFolderId!;

      // Intentar subir el archivo
      try {
        const result = await uploadFileToDrive(
          accessToken,
          apcDocumentFile,
          folderId,
          'APC_Documento.pdf'
        );

        if (result) {
          // Guardar el ID en la BD
          const success = await updateCompanyApcDocument(companyId, result.fileId);
          if (success) {
            setNotification({
              isOpen: true,
              type: 'success',
              message: 'Documento APC subido exitosamente. Los prospectos usarán este documento al firmar.',
              title: 'Documento actualizado'
            });
            // Actualizar companyData
            setCompanyData({ ...companyData, apcDocumentDriveId: result.fileId });
            setApcDocumentFile(null);
          } else {
            setNotification({
              isOpen: true,
              type: 'error',
              message: 'El archivo se subió pero no se pudo guardar la referencia.',
              title: 'Error parcial'
            });
          }
        }
      } catch (error: any) {
        // Si es 401, intentar refrescar token
        if (error?.status === 401 && refreshToken) {
          console.log('🔄 Token expirado, renovando...');
          const newAccessToken = await refreshAccessToken(refreshToken);
          if (newAccessToken) {
            // Actualizar token en BD
            await updateCompanyGoogleDriveConfig(companyId, newAccessToken, refreshToken, folderId);
            // Reintentar subida
            const result = await uploadFileToDrive(
              newAccessToken,
              apcDocumentFile,
              folderId,
              'APC_Documento.pdf'
            );
            if (result) {
              const success = await updateCompanyApcDocument(companyId, result.fileId);
              if (success) {
                setNotification({
                  isOpen: true,
                  type: 'success',
                  message: 'Documento APC subido exitosamente.',
                  title: 'Documento actualizado'
                });
                setCompanyData({ ...companyData, apcDocumentDriveId: result.fileId });
                setApcDocumentFile(null);
              }
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error subiendo documento APC:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al subir el documento APC. Verifica tu conexión con Google Drive.',
        title: 'Error de subida'
      });
    } finally {
      setIsUploadingApcDocument(false);
    }
  };

  // Funciones de exportación
  const filterProspectsForExport = (): Prospect[] => {
    let filtered = [...prospects];

    // Filtrar por rango de fechas si está seleccionado
    if (exportFilterType === 'dateRange' && dateRangeStart && dateRangeEnd) {
      const startDate = new Date(dateRangeStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRangeEnd);
      endDate.setHours(23, 59, 59, 999); // Incluir todo el día final

      filtered = filtered.filter(p => {
        const prospectDate = new Date(p.date);
        return prospectDate >= startDate && prospectDate <= endDate;
      });
    }

    // Filtrar por rango salarial
    if (exportSalaryRange) {
      filtered = filtered.filter(p => {
        const income = p.income;
        switch (exportSalaryRange) {
          case '0-3000':
            return income < 3000;
          case '3000-5000':
            return income >= 3000 && income < 5000;
          case '5000-8000':
            return income >= 5000 && income < 8000;
          case '8000-12000':
            return income >= 8000 && income < 12000;
          case '12000+':
            return income >= 12000;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filteredData = filterProspectsForExport();

    if (filteredData.length === 0) {
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'No hay datos para exportar con los filtros seleccionados.',
        title: 'Sin datos'
      });
      return;
    }

    // Preparar datos para CSV
    const headers = [
      'ID',
      'Nombre Completo',
      'Email',
      'Teléfono',
      'Ingreso Mensual',
      'Tipo de Propiedad',
      'Habitaciones',
      'Baños',
      'Zonas de Interés',
      'Precio Máximo',
      'Pago Mensual',
      'Enganche (%)',
      'Enganche ($)',
      'Estado',
      'Fecha de Registro'
    ];

    const rows = filteredData.map(p => [
      p.id,
      p.name || 'N/A',
      p.email || 'N/A',
      p.phone || 'N/A',
      p.income.toFixed(2), // Sin formato de moneda para CSV (mejor para Excel)
      p.propertyType || 'N/A',
      p.bedrooms?.toString() || 'N/A',
      p.bathrooms?.toString() || 'N/A',
      Array.isArray(p.zone) ? p.zone.join(', ') : (typeof p.zone === 'string' ? p.zone : 'N/A'),
      (p.result?.maxPropertyPrice || 0).toFixed(2),
      (p.result?.monthlyPayment || 0).toFixed(2),
      `${p.result?.downPaymentPercent || 0}%`,
      (p.result?.downPaymentAmount || 0).toFixed(2),
      p.status || 'Nuevo',
      p.dateDisplay || new Date(p.date).toLocaleDateString('es-PA')
    ]);

    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Crear BOM para Excel (UTF-8)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospectos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
  };

  const exportToExcel = () => {
    try {
      const filteredData = filterProspectsForExport();

      console.log('📊 Datos filtrados para exportar:', filteredData.length);

      if (filteredData.length === 0) {
        setNotification({
          isOpen: true,
          type: 'warning',
          message: 'No hay datos para exportar con los filtros seleccionados.',
          title: 'Sin datos'
        });
        return;
      }

      // Preparar datos para Excel
      const worksheetData = filteredData.map(p => ({
        'ID': p.id,
        'Nombre Completo': p.name || 'N/A',
        'Email': p.email || 'N/A',
        'Teléfono': p.phone || 'N/A',
        'Ingreso Mensual': p.income,
        'Tipo de Propiedad': p.propertyType || 'N/A',
        'Habitaciones': p.bedrooms ?? 'N/A',
        'Baños': p.bathrooms ?? 'N/A',
        'Zonas de Interés': Array.isArray(p.zone) ? p.zone.join(', ') : (typeof p.zone === 'string' ? p.zone : 'N/A'),
        'Precio Máximo': p.result?.maxPropertyPrice || 0,
        'Pago Mensual': p.result?.monthlyPayment || 0,
        'Enganche (%)': p.result?.downPaymentPercent || 0,
        'Enganche ($)': p.result?.downPaymentAmount || 0,
        'Estado': p.status || 'Nuevo',
        'Fecha de Registro': p.dateDisplay || new Date(p.date).toLocaleDateString('es-PA')
      }));

      console.log('📝 Datos preparados para Excel:', worksheetData.length, 'filas');

      // Crear workbook y worksheet
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospectos');

      // Ajustar ancho de columnas
      const columnWidths = [
        { wch: 10 }, // ID
        { wch: 25 }, // Nombre
        { wch: 30 }, // Email
        { wch: 15 }, // Teléfono
        { wch: 15 }, // Ingreso
        { wch: 18 }, // Tipo Propiedad
        { wch: 12 }, // Habitaciones
        { wch: 10 }, // Baños
        { wch: 30 }, // Zonas
        { wch: 15 }, // Precio Máximo
        { wch: 15 }, // Pago Mensual
        { wch: 12 }, // Enganche %
        { wch: 15 }, // Enganche $
        { wch: 15 }, // Estado
        { wch: 18 }  // Fecha
      ];
      worksheet['!cols'] = columnWidths;

      // Descargar archivo
      const fileName = `prospectos_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log('💾 Descargando archivo:', fileName);
      XLSX.writeFile(workbook, fileName);

      console.log('✅ Archivo Excel descargado exitosamente');
      setShowExportModal(false);
    } catch (error) {
      console.error('❌ Error exportando a Excel:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al exportar a Excel. Por favor intenta de nuevo.',
        title: 'Error de exportación'
      });
    }
  };

  const handleExport = () => {
    try {
      console.log('🔄 Iniciando exportación...', {
        format: exportFormat,
        filterType: exportFilterType,
        salaryRange: exportSalaryRange,
        dateRange: { start: dateRangeStart, end: dateRangeEnd },
        totalProspects: prospects.length
      });

      if (exportFormat === 'csv') {
        exportToCSV();
      } else {
        exportToExcel();
      }
    } catch (error) {
      console.error('❌ Error en handleExport:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        message: 'Error al exportar los datos. Por favor intenta de nuevo.',
        title: 'Error de exportación'
      });
    }
  };

  // Generate Embed Code with ROUNDED CORNERS and SHADOW enforced on the iframe
  const appUrl = window.location.href.split('?')[0];
  const companyId = localStorage.getItem('companyId');
  const embedUrl = companyId
    ? `${appUrl}?mode=embed&company_id=${companyId}`
    : `${appUrl}?mode=embed`;

  const embedCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="750" 
  frameborder="0" 
  style="border-radius: 30px; box-shadow: 0 20px 60px -10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid rgba(0,0,0,0.05);"
></iframe>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPreview = () => {
    const companyId = localStorage.getItem('companyId');
    const previewUrl = companyId
      ? `${appUrl}?mode=embed&company_id=${companyId}`
      : `${appUrl}?mode=embed`;
    window.open(previewUrl, '_blank');
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in-up pb-24 md:pb-0">

        {/* Top Menu Tabs (Desktop Only) */}
        <div className="hidden md:flex justify-center mb-6 sm:mb-10 relative" style={{ overflow: 'visible' }}>
          <div className="bg-white p-1 sm:p-1.5 rounded-2xl shadow-sm border border-gray-100 inline-flex gap-1 overflow-x-auto" style={{ overflow: 'visible' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${activeTab === 'dashboard'
                ? 'bg-primary-50 text-primary-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <LayoutDashboard size={14} className="sm:w-4 sm:h-4" /> <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${activeTab === 'prospects'
                ? 'bg-primary-50 text-primary-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Users size={14} className="sm:w-4 sm:h-4" /> <span>Prospectos</span>
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${activeTab === 'properties'
                ? 'bg-primary-50 text-primary-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Building size={14} className="sm:w-4 sm:h-4" /> <span>{isPromotora ? 'Proyectos' : 'Propiedades'}</span>
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 relative ${activeTab === 'campaigns'
                ? 'bg-primary-50 text-primary-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <MessageCircle size={14} className="sm:w-4 sm:h-4" /> <span className="relative">Campañas</span>
              <span className="absolute -top-[0.575rem] right-0 text-white text-[7px] font-black px-1 py-0.5 rounded-full shadow-sm border border-white/50" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}>NUEVO</span>
            </button>
            <button
              onClick={() => setActiveTab('forms')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 relative ${activeTab === 'forms'
                ? 'bg-primary-50 text-primary-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <LinkIcon size={14} className="sm:w-4 sm:h-4" /> <span>Formularios</span>
            </button>
            <div
              className="relative settings-submenu-container"
              onMouseEnter={() => {
                // Cancelar cualquier timeout pendiente
                if (settingsSubmenuTimeout) {
                  clearTimeout(settingsSubmenuTimeout);
                  setSettingsSubmenuTimeout(null);
                }
                setShowSettingsSubmenu(true);
              }}
              onMouseLeave={() => {
                // Agregar delay antes de ocultar el submenú
                const timeout = setTimeout(() => {
                  setShowSettingsSubmenu(false);
                }, 200); // 200ms de delay
                setSettingsSubmenuTimeout(timeout);
              }}
            >
              <button
                onClick={() => {
                  if (activeTab !== 'settings' && activeTab !== 'calculator-config') {
                    setActiveTab('settings');
                  }
                }}
                className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 sm:gap-2 shrink-0 ${(activeTab === 'settings' || activeTab === 'calculator-config')
                  ? 'bg-primary-50 text-primary-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Settings size={14} className="sm:w-4 sm:h-4" /> <span>Configuración</span>
                <ChevronDown
                  size={14}
                  className={`sm:w-4 sm:h-4 transition-transform ${showSettingsSubmenu ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Submenú de Configuración */}
              {showSettingsSubmenu && (
                <div
                  className="absolute top-full left-0 mt-1 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[1000]"
                  onMouseEnter={() => {
                    // Cancelar timeout si el mouse entra al submenú
                    if (settingsSubmenuTimeout) {
                      clearTimeout(settingsSubmenuTimeout);
                      setSettingsSubmenuTimeout(null);
                    }
                  }}
                >
                  <button
                    onClick={() => {
                      setActiveTab('calculator-config');
                      setShowSettingsSubmenu(false);
                    }}
                    className={`w-full px-5 py-4 text-left hover:bg-primary-50/50 transition-colors flex items-start gap-4 border-b border-gray-50 last:border-b-0 ${activeTab === 'calculator-config' ? 'bg-primary-50' : ''
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'calculator-config'
                      ? 'bg-indigo-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-primary-50'
                      }`}>
                      <Calculator size={22} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm mb-1.5 ${activeTab === 'calculator-config' ? 'text-primary-600' : 'text-gray-900'
                        }`}>
                        Configurar Calculadora
                      </div>
                      <div className="text-xs text-gray-500 leading-relaxed">
                        Integración web, documentos y zonas
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowSettingsSubmenu(false);
                    }}
                    className={`w-full px-5 py-4 text-left hover:bg-primary-50/50 transition-colors flex items-start gap-4 ${activeTab === 'settings' ? 'bg-primary-50' : ''
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'settings'
                      ? 'bg-indigo-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-primary-50'
                      }`}>
                      <Shield size={22} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm mb-1.5 ${activeTab === 'settings' ? 'text-primary-600' : 'text-gray-900'
                        }`}>
                        Configuración General
                      </div>
                      <div className="text-xs text-gray-500 leading-relaxed">
                        Plan, Google Drive y perfil
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'campaigns' ? (
          <WhatsBlastTab prospects={prospects} />
        ) : activeTab === 'dashboard' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-8">
            {/* Card 1: Total Forms */}
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
                <FileText size={24} className="md:w-8 md:h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] md:text-xs mb-2">Formularios Completados</h3>
              <p className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
                {isLoading ? <Loader2 className="animate-spin" /> : totalForms}
              </p>
              <span className="mt-4 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full">Actualizado hoy</span>
            </div>

            {/* Card 2: Average Salary */}
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
                <DollarSign size={24} className="md:w-8 md:h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] md:text-xs mb-2">Promedio Salarial</h3>
              <p className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
                {isLoading ? <Loader2 className="animate-spin" /> : formatCurrency(avgSalary)}
              </p>
              <span className="mt-4 text-gray-400 text-[10px] font-medium">Basado en {totalForms} registros</span>
            </div>

            {/* Card 3: Avg Purchasing Capacity */}
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
                <Briefcase size={24} className="md:w-8 md:h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] md:text-xs mb-2">Capacidad de Compra Prom.</h3>
              <p className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
                {isLoading ? <Loader2 className="animate-spin" /> : formatCurrency(avgCapacity)}
              </p>
              <span className="mt-4 text-gray-400 text-[10px] font-medium">Potencial de cierre</span>
            </div>

            {/* Card 4: Top Zones (solo para Broker) */}
            {!isPromotora && (
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-lg transition-all duration-500 cursor-pointer" onClick={() => sortedZones.length > 0 && setShowZonesModal(true)}>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
                  <MapPin size={24} className="md:w-8 md:h-8" strokeWidth={1.5} />
                </div>
                <h3 className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] md:text-xs mb-2">Zonas Más Buscadas</h3>
                <p className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight px-4 leading-tight">
                  {isLoading ? (
                    <Loader2 className="animate-spin mx-auto" />
                  ) : sortedZones.length === 0 ? (
                    'Aún no tenemos datos'
                  ) : (
                    <>
                      {topTwoZones.join(', ')}
                      {hasMoreZones && (
                        <span
                          className="text-orange-600 hover:text-orange-700 cursor-pointer ml-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowZonesModal(true);
                          }}
                        >
                          y ...
                        </span>
                      )}
                    </>
                  )}
                </p>
                <span className="mt-4 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full">
                  {totalZones > 0 ? `${totalZones} ${totalZones === 1 ? 'zona' : 'zonas'}` : '0 zonas'}
                </span>
              </div>
            )}
          </div>
        ) : activeTab === 'prospects' ? (
          <div className="bg-transparent md:bg-white rounded-[2.5rem] shadow-none md:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border-0 md:border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">

            {/* List Header */}
            <div className="px-0 py-2 md:p-8 border-b-0 md:border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Base de Prospectos</h2>
                <p className="text-gray-500 text-sm">Gestiona y analiza los datos capturados.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshProspects}
                  disabled={isRefreshing}
                  className="bg-primary-600 hover:bg-primary-700 disabled:bg-indigo-400 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary-200 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'Actualizando...' : 'Actualizar'}
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-gray-200"
                >
                  <Download size={16} /> Exportar Data
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="animate-spin text-primary-500" />
                    <p className="text-sm font-medium">Cargando base de datos...</p>
                  </div>
                </div>
              ) : paginatedProspects.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                  <p>Aún no hay prospectos registrados.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    {/* Tabla Visible en Desktop/Tablet */}
                    <table className="w-full text-left border-collapse min-w-[600px] hidden md:table">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-wider">
                          <th className="px-4 sm:px-8 py-4 sm:py-6 font-semibold rounded-tl-[2rem]">Prospecto</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold hidden lg:table-cell">Teléfono</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Ingreso</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold">Capacidad</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold hidden md:table-cell">Zona</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold hidden lg:table-cell">Origen</th>
                          <th className="px-3 sm:px-6 py-4 sm:py-6 font-semibold hidden sm:table-cell">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedProspects.map((prospect) => (
                          <tr
                            key={prospect.id}
                            onClick={() => setSelectedProspect(prospect)}
                            className="hover:bg-primary-50/30 transition-colors group cursor-pointer"
                          >
                            <td className="px-4 sm:px-8 py-4 sm:py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900 text-sm">{prospect.name}</span>
                                <span className="text-xs text-gray-400 hidden sm:inline">{prospect.email}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5 hidden lg:table-cell">
                              <span className="text-sm text-gray-600 font-medium">{prospect.phone || 'N/A'}</span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                              <span className="font-medium text-gray-700 text-sm">{formatCurrency(prospect.income)}</span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5">
                              <span className="font-bold text-primary-600 bg-primary-50 px-2 sm:px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                                {formatCurrency(prospect.result?.maxPropertyPrice || 0)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-600 font-medium truncate max-w-[150px]">
                                  {Array.isArray(prospect.zone) ? prospect.zone.join(', ') : (typeof prospect.zone === 'string' ? prospect.zone : 'Sin zona')}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 sm:py-5 hidden sm:table-cell">
                              <span className="text-sm text-gray-500 whitespace-nowrap">{prospect.dateDisplay || new Date(prospect.date).toLocaleDateString('es-PA')}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Vista de Tarjetas Visible Solo en Móvil */}
                    <div className="md:hidden space-y-4 pt-4">
                      {paginatedProspects.map((prospect) => (
                        <div
                          key={prospect.id}
                          className="bg-white rounded-[2.5rem] border border-primary-100 shadow-md p-5 mx-5 active:bg-gray-50 active:scale-[0.98] transition-all relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => setSelectedProspect(prospect)}
                            >
                              <h3 className="font-bold text-gray-900 text-base mb-1">{prospect.name}</h3>
                              <p className="text-xs text-gray-500">{prospect.email}</p>
                            </div>
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                              {prospect.dateDisplay || new Date(prospect.date).toLocaleDateString('es-PA')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Capacidad Max</p>
                              <p className="text-lg font-bold text-primary-600">
                                {formatCurrency(prospect.result?.maxPropertyPrice || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Ingreso</p>
                              <p className="text-sm font-semibold text-gray-700">
                                {formatCurrency(prospect.income)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate max-w-[50%]">
                              <MapPin size={12} className="text-gray-400" />
                              <span className="truncate">
                                {Array.isArray(prospect.zone) ? prospect.zone[0] : (typeof prospect.zone === 'string' ? prospect.zone : 'Sin zona')}
                              </span>
                            </div>

                            {prospect.phone ? (
                              <a
                                href={`tel:${prospect.phone}`}
                                className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Users size={12} />
                                Llamar
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">Sin teléfono</span>
                            )}
                          </div>

                          <button
                            className="w-full mt-3 text-center text-xs font-semibold text-primary-600 py-2 border border-primary-100 rounded-lg hover:bg-primary-50"
                            onClick={() => setSelectedProspect(prospect)}
                          >
                            Ver Detalles
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="p-6 border-t border-gray-100 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : activeTab === 'properties' ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Gestión de {isPromotora ? 'Proyectos' : 'Propiedades'}</h2>
                <p className="text-gray-500 text-sm">Administra los {isPromotora ? 'proyectos' : 'propiedades'} que se mostrarán a tus prospectos</p>
              </div>
              {companyData?.plan === 'Wolf of Wallstreet' ? (
                <button
                  onClick={() => {
                    if (isPromotora) {
                      setShowProjectSelectionModal(true);
                    } else {
                      setShowPropertySelectionModal(true);
                    }
                  }}
                  className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-lg shadow-primary-200"
                >
                  <Plus size={18} /> Agregar {isPromotora ? 'Proyecto' : 'Propiedad'}
                </button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Necesitas el plan <strong>"Wolf of Wallstreet"</strong> para gestionar {isPromotora ? 'proyectos' : 'propiedades'}
                  </p>
                </div>
              )}
            </div>

            {/* Properties List */}
            {isLoadingProperties ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="text-gray-500 mt-4">Cargando {isPromotora ? 'proyectos' : 'propiedades'}...</p>
              </div>
            ) : (isPromotora ? projects.length === 0 : properties.length === 0) ? (
              <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100">
                <Building size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No hay {isPromotora ? 'proyectos' : 'propiedades'} registrados</h3>
                <p className="text-gray-500 mb-6">Comienza agregando tu primer {isPromotora ? 'proyecto' : 'propiedad'} para mostrarlo a los prospectos</p>
                {companyData?.plan === 'Wolf of Wallstreet' && (
                  <button
                    onClick={() => {
                      if (isPromotora) {
                        setShowProjectSelectionModal(true);
                      } else {
                        setShowPropertySelectionModal(true);
                      }
                    }}
                    className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Agregar Primer {isPromotora ? 'Proyecto' : 'Propiedad'}
                  </button>
                )}
              </div>
            ) : isPromotora ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {project.images && project.images.length > 0 ? (
                        <img
                          src={project.images[0]}
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                          <Building size={48} />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${project.status === 'Activo' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'
                        }`}>
                        {project.status}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-gray-900 mb-1 text-lg">{project.name}</h4>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-3">
                        <MapPin size={14} />
                        <span>{project.zone}</span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
                      )}
                      <div className="pt-3 border-t border-gray-100 mb-3">
                        <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Modelos</div>
                        <div className="text-lg font-bold text-primary-600">{project.models?.length || 0} {project.models?.length === 1 ? 'modelo' : 'modelos'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProjectForEdit(project);
                            setShowProjectModal(true);
                          }}
                          className="flex-1 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl font-semibold hover:bg-primary-100 transition-colors text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
                              const success = await deleteProject(project.id);
                              if (success) {
                                const companyId = localStorage.getItem('companyId');
                                if (companyId) {
                                  await loadProjects(true);
                                  setNotification({
                                    isOpen: true,
                                    type: 'success',
                                    message: 'Proyecto eliminado exitosamente',
                                    title: 'Éxito'
                                  });
                                }
                              } else {
                                setNotification({
                                  isOpen: true,
                                  type: 'error',
                                  message: 'Error al eliminar el proyecto',
                                  title: 'Error'
                                });
                              }
                            }
                          }}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors text-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all group"
                  >
                    {/* Imagen */}
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                          <Building size={48} className="text-primary-300" />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white ${property.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                        }`}>
                        {property.type}
                      </div>
                      <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-semibold ${property.status === 'Activa' ? 'bg-green-50 text-green-700' :
                        property.status === 'Vendida' ? 'bg-gray-100 text-gray-600' :
                          property.status === 'Alquilada' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                        {property.status}
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="p-5">
                      <h4 className="font-bold text-gray-900 mb-2 text-lg">{property.title}</h4>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                        <MapPin size={14} />
                        <span>{property.zone}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        {property.bedrooms && (
                          <div className="flex items-center gap-1.5">
                            <BedDouble size={16} className="text-gray-400" />
                            <span>{property.bedrooms}</span>
                          </div>
                        )}
                        {property.bathrooms && (
                          <div className="flex items-center gap-1.5">
                            <Bath size={16} className="text-gray-400" />
                            <span>{property.bathrooms}</span>
                          </div>
                        )}
                        {property.areaM2 && (
                          <div className="text-gray-400">
                            {property.areaM2}m²
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                          <div className="text-xl font-bold text-gray-900">{formatCurrency(property.price)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPropertyForEdit(property);
                              setShowPropertyModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Settings size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Estás seguro de eliminar esta propiedad?')) {
                                const success = await deleteProperty(property.id);
                                if (success) {
                                  setProperties(properties.filter(p => p.id !== property.id));
                                }
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'calculator-config' ? (
          <div className="space-y-8">

            {/* Integración Web */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>

              <div className="p-8 border-b border-gray-50">
                <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center mb-4 shadow-lg shadow-gray-200">
                  <Code size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Integración Web</h3>
                <p className="text-sm text-gray-500 mt-2">Copia este código para añadir la calculadora a tu sitio web.</p>
              </div>

              <div className="p-6 bg-gray-50/50">
                <div className="bg-gray-900 rounded-xl p-4 mb-4 relative">
                  <code className="text-xs text-gray-300 font-mono whitespace-pre-wrap block overflow-visible">
                    {embedCode}
                  </code>
                  <div className="absolute right-2 top-2">
                    <button
                      onClick={copyToClipboard}
                      className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors backdrop-blur-sm"
                      title="Copiar código"
                    >
                      {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={openPreview}
                  className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} /> Previsualizar Formulario
                </button>
              </div>
            </div>

            {/* Documentación Solicitada */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                  <FileCheck size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Documentación Solicitada</h3>
                <p className="text-sm text-gray-500 mt-2">Configura qué documentos solicitar a los prospectos en el formulario.</p>
              </div>

              <div className="p-8 space-y-4">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedDocuments.idFile}
                      onChange={(e) => setRequestedDocuments({ ...requestedDocuments, idFile: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">Foto de Cédula / ID</span>
                      <p className="text-xs text-gray-500 mt-0.5">Documento de identificación del cliente</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedDocuments.fichaFile}
                      onChange={(e) => setRequestedDocuments({ ...requestedDocuments, fichaFile: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">Ficha de Seguro Social</span>
                      <p className="text-xs text-gray-500 mt-0.5">Comprobante de seguro social</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedDocuments.talonarioFile}
                      onChange={(e) => setRequestedDocuments({ ...requestedDocuments, talonarioFile: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">Talonario de Pago</span>
                      <p className="text-xs text-gray-500 mt-0.5">Comprobante de ingresos del cliente</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedDocuments.signedAcpFile}
                      onChange={(e) => setRequestedDocuments({ ...requestedDocuments, signedAcpFile: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">Autorización APC Firmada</span>
                      <p className="text-xs text-gray-500 mt-0.5">Documento de autorización para consulta de crédito</p>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSaveRequestedDocuments}
                    disabled={isSavingDocuments}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingDocuments ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Guardar Configuración
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Documento APC Personalizado */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <FileTextIcon size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Documento APC Personalizado</h3>
                <p className="text-sm text-gray-500 mt-2">Sube tu propio documento APC. Los prospectos podrán descargarlo y firmarlo en línea.</p>
              </div>

              <div className="p-8 space-y-4">
                {companyData?.apcDocumentDriveId ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="text-green-600" size={20} />
                      <span className="font-semibold text-green-800">Documento APC configurado</span>
                    </div>
                    <p className="text-sm text-green-700">Los prospectos usarán tu documento personalizado al firmar.</p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800">No hay documento personalizado. Se usará el documento por defecto.</p>
                  </div>
                )}

                <div className="border border-dashed border-gray-300 rounded-xl p-6 bg-gray-50/50">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setApcDocumentFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="apc-document-upload"
                  />
                  <label
                    htmlFor="apc-document-upload"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    {apcDocumentFile ? (
                      <>
                        <FileCheck size={32} className="text-primary-600 mb-2" />
                        <p className="text-sm font-semibold text-gray-900">{apcDocumentFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(apcDocumentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <Upload size={32} className="text-gray-400 mb-2" />
                        <p className="text-sm font-semibold text-gray-600">Click para seleccionar PDF</p>
                        <p className="text-xs text-gray-400 mt-1">Solo archivos PDF</p>
                      </>
                    )}
                  </label>
                </div>

                {apcDocumentFile && (
                  <button
                    onClick={handleUploadApcDocument}
                    disabled={isUploadingApcDocument || !isGoogleDriveConnected}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isUploadingApcDocument ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Subiendo a Google Drive...
                      </>
                    ) : (
                      <>
                        <Cloud size={18} />
                        Subir Documento APC
                      </>
                    )}
                  </button>
                )}

                {!isGoogleDriveConnected && (
                  <p className="text-xs text-amber-600 text-center">
                    ⚠️ Debes conectar Google Drive primero para subir documentos personalizados.
                  </p>
                )}
              </div>
            </div>

            {/* Zonas de Preferencia */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                  <MapPin size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Zonas de Preferencia</h3>
                <p className="text-sm text-gray-500 mt-2">Gestiona las áreas que se muestran a los clientes potenciales.</p>
              </div>

              <div className="p-6 bg-gray-50/50">
                <div className="flex flex-wrap gap-2 mb-6">
                  {availableZones.map(zone => (
                    <div key={zone} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm group hover:border-red-200 hover:bg-red-50 transition-colors">
                      {zone}
                      <button
                        onClick={() => handleDeleteZone(zone)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddZone()}
                    placeholder="Nueva Zona..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 outline-none bg-white"
                  />
                  <button
                    onClick={handleAddZone}
                    disabled={isSavingZones || !newZone.trim()}
                    className="bg-gray-900 text-white p-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    {isSavingZones ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Plus size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'forms' ? (
          <div className="max-w-5xl mx-auto">
            <FormsManager companyId={companyId} />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="space-y-8">

            {/* Plan de Suscripción */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <ShieldCheck size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Plan de Suscripción</h3>
                  <p className="text-sm text-gray-500">Elige el plan que mejor se adapte a tus necesidades.</p>
                </div>
              </div>

              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      const companyId = localStorage.getItem('companyId');
                      if (companyId) {
                        const success = await updateCompanyPlan(companyId, 'Freshie');
                        if (success && companyData) {
                          setCompanyData({ ...companyData, plan: 'Freshie' });
                        }
                      }
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left ${companyData?.plan === 'Freshie'
                      ? 'border-primary-500 bg-primary-50/30 shadow-lg'
                      : 'border-gray-200 hover:border-primary-200 hover:bg-primary-50/20'
                      }`}
                  >
                    <div className="font-bold text-xl text-gray-900 mb-2">Plan Freshie</div>
                    <div className="text-sm text-gray-600 mb-4">Plan gratuito con funciones básicas</div>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span>Gestión de prospectos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span>Dashboard de análisis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <X size={16} className="text-gray-300" />
                        <span className="text-gray-400">Gestión de propiedades</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="text-3xl font-bold text-gray-900">$0.00</div>
                      <div className="text-sm text-gray-500">/ mes</div>
                    </div>
                    {companyData?.plan === 'Freshie' && (
                      <div className="mt-4 text-xs font-semibold text-primary-600 bg-indigo-100 px-3 py-1 rounded-full inline-block">
                        Plan Actual
                      </div>
                    )}
                  </button>

                  <button
                    onClick={async () => {
                      const companyId = localStorage.getItem('companyId');
                      if (companyId) {
                        const success = await updateCompanyPlan(companyId, 'Wolf of Wallstreet');
                        if (success && companyData) {
                          setCompanyData({ ...companyData, plan: 'Wolf of Wallstreet' });
                          if (activeTab === 'properties') {
                            await loadProperties(true);
                          }
                        }
                      }
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${companyData?.plan === 'Wolf of Wallstreet'
                      ? 'border-primary-500 bg-primary-50/30 shadow-lg'
                      : 'border-gray-200 hover:border-primary-200 hover:bg-primary-50/20'
                      }`}
                  >
                    {companyData?.plan === 'Wolf of Wallstreet' && (
                      <div className="absolute top-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}>
                        Premium
                      </div>
                    )}
                    <div className="font-bold text-xl text-gray-900 mb-2">Plan Wolf of Wallstreet</div>
                    <div className="text-sm text-gray-600 mb-4">Plan premium con todas las funciones</div>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span>Todas las funciones del plan Freshie</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-primary-500" />
                        <span className="font-semibold text-primary-600">Gestión de propiedades</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-primary-500" />
                        <span className="font-semibold text-primary-600">Mostrar propiedades a prospectos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-primary-500" />
                        <span className="font-semibold text-primary-600">Seguimiento de intereses</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="text-3xl font-bold text-gray-900">$6.99</div>
                      <div className="text-sm text-gray-500">/ mes</div>
                    </div>
                    {companyData?.plan === 'Wolf of Wallstreet' && (
                      <div className="mt-4 text-xs font-semibold text-primary-600 bg-primary-100 px-3 py-1 rounded-full inline-block">
                        Plan Actual
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Integración con Google Drive */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Cloud size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Integración con Google Drive</h3>
                  <p className="text-sm text-gray-500">Conecta tu cuenta para organizar automáticamente los documentos de tus prospectos.</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-primary-50/60 border border-primary-100 rounded-2xl p-4 text-sm text-primary-900">
                  <p className="font-semibold mb-2">¿Qué hace esta integración?</p>
                  <ul className="list-disc list-inside space-y-1 text-primary-800">
                    <li>Guarda automáticamente los documentos de tus prospectos en carpetas por cliente.</li>
                    <li>Te permite acceder a todos los archivos directamente desde Google Drive.</li>
                    <li>Actúa como backup en la nube para tu documentación.</li>
                  </ul>
                </div>

                {isGoogleDriveConnected ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-green-600" size={24} />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Google Drive conectado</p>
                        <p className="text-xs text-green-700">
                          Los documentos de tus prospectos se están guardando automáticamente en tu carpeta configurada.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          initiateGoogleDriveAuth();
                        } catch (error) {
                          console.error('Error iniciando Google Drive auth desde Configuración:', error);
                          setNotification({
                            isOpen: true,
                            type: 'error',
                            message: 'Error al reconectar con Google Drive. Por favor verifica la configuración.',
                            title: 'Error de conexión'
                          });
                        }
                      }}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-800 border border-primary-200 rounded-full px-4 py-2 bg-white hover:bg-primary-50 transition-colors"
                    >
                      Reconectar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      try {
                        initiateGoogleDriveAuth();
                      } catch (error) {
                        console.error('Error iniciando Google Drive auth desde Configuración:', error);
                        setNotification({
                          isOpen: true,
                          type: 'error',
                          message: 'Error al conectar con Google Drive. Por favor verifica la configuración.',
                          title: 'Error de conexión'
                        });
                      }
                    }}
                    className="w-full py-4 px-6 bg-white border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center gap-3 shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Conectar con Google Drive
                  </button>
                )}
              </div>
            </div>

            {/* Perfil de Empresa */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Perfil de Empresa</h3>
                  <p className="text-sm text-gray-500">Personaliza la identidad visual de la plataforma.</p>
                </div>
              </div>

              <div className="p-8 grid md:grid-cols-3 gap-8 items-center">
                <div className="text-center md:text-left">
                  <label className="cursor-pointer">
                    {(() => {
                      const hasLogo = companyData?.logoUrl && companyData.logoUrl.trim() !== '' && companyData.logoUrl !== 'null' && companyData.logoUrl !== 'undefined';
                      const shouldShow = hasLogo && !logoError;

                      if (companyData) {
                        console.log('🔍 Verificando logo:', {
                          hasCompanyData: true,
                          hasLogoUrl: !!companyData.logoUrl,
                          logoUrlPreview: companyData.logoUrl ? companyData.logoUrl.substring(0, 80) + '...' : 'none',
                          logoUrlType: companyData.logoUrl ? (companyData.logoUrl.startsWith('data:') ? 'base64' : companyData.logoUrl.startsWith('blob:') ? 'blob' : 'url') : 'none',
                          logoError,
                          shouldShow
                        });
                      }

                      return shouldShow;
                    })() ? (
                      <div className="w-32 h-32 rounded-3xl border-2 border-gray-200 overflow-hidden bg-white flex items-center justify-center mx-auto md:mx-0 shadow-sm relative group">
                        <img
                          src={companyData.logoUrl}
                          alt="Logo de la empresa"
                          className="w-full h-full object-contain p-2"
                          onLoad={() => {
                            console.log('✅ Logo cargado exitosamente');
                          }}
                          onError={(e) => {
                            console.error('❌ Error cargando logo:', {
                              src: companyData.logoUrl,
                              srcType: companyData.logoUrl.startsWith('data:') ? 'base64' : companyData.logoUrl.startsWith('blob:') ? 'blob' : 'url',
                              error: e
                            });
                            setLogoError(true);
                          }}
                        />
                        {isUpdatingLogo ? (
                          <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-3xl">
                            <Loader2 className="animate-spin text-primary-600" size={24} />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                            <span className="text-white text-xs font-semibold">Cambiar</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary-300 hover:bg-primary-50/30 transition-all mx-auto md:mx-0">
                        {isUpdatingLogo ? (
                          <Loader2 className="animate-spin text-primary-600" size={32} />
                        ) : (
                          <>
                            <ImageIcon size={32} strokeWidth={1} />
                            <span className="text-xs font-semibold mt-2">Cambiar Logo</span>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Validar tamaño (máx 2MB)
                        if (file.size > 2 * 1024 * 1024) {
                          setNotification({
                            isOpen: true,
                            type: 'warning',
                            message: 'El logo debe ser menor a 2MB.',
                            title: 'Archivo muy grande'
                          });
                          return;
                        }

                        setIsUpdatingLogo(true);
                        setLogoError(false);

                        try {
                          // Convertir a base64
                          const reader = new FileReader();
                          reader.readAsDataURL(file);
                          reader.onload = async () => {
                            const base64 = reader.result as string;

                            const companyId = localStorage.getItem('companyId');
                            if (!companyId) {
                              setNotification({
                                isOpen: true,
                                type: 'error',
                                message: 'No se encontró el ID de la empresa. Por favor, inicia sesión nuevamente.',
                                title: 'Error de sesión'
                              });
                              setIsUpdatingLogo(false);
                              return;
                            }

                            // Actualizar en la base de datos
                            const success = await updateCompanyLogo(companyId, base64);

                            if (success) {
                              // Actualizar el estado local
                              if (companyData) {
                                setCompanyData({ ...companyData, logoUrl: base64 });
                              }
                              console.log('✅ Logo actualizado exitosamente');
                            } else {
                              setNotification({
                                isOpen: true,
                                type: 'error',
                                message: 'Error al actualizar el logo. Por favor intenta de nuevo.',
                                title: 'Error al actualizar'
                              });
                            }

                            setIsUpdatingLogo(false);
                          };
                          reader.onerror = () => {
                            setNotification({
                              isOpen: true,
                              type: 'error',
                              message: 'Error al leer el archivo. Verifica que sea una imagen válida.',
                              title: 'Error de archivo'
                            });
                            setIsUpdatingLogo(false);
                          };
                        } catch (error) {
                          console.error('Error actualizando logo:', error);
                          setNotification({
                            isOpen: true,
                            type: 'error',
                            message: 'Error al actualizar el logo. Por favor intenta de nuevo.',
                            title: 'Error al actualizar'
                          });
                          setIsUpdatingLogo(false);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre de la Empresa</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => onUpdateCompanyName(e.target.value)}
                      className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-gray-50 focus:bg-white transition-colors text-gray-900 font-medium"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        const companyId = localStorage.getItem('companyId');
                        if (!companyId) return;

                        setIsSavingCompanyName(true);
                        try {
                          const success = await updateCompanyName(companyId, companyName);
                          if (success) {
                            setNotification({
                              isOpen: true,
                              type: 'success',
                              message: 'Nombre de la empresa actualizado exitosamente.',
                              title: 'Actualizado'
                            });
                            onUpdateCompanyName(companyName);
                          } else {
                            setNotification({
                              isOpen: true,
                              type: 'error',
                              message: 'Error al actualizar el nombre de la empresa.',
                              title: 'Error'
                            });
                          }
                        } catch (error) {
                          console.error('Error actualizando nombre:', error);
                          setNotification({
                            isOpen: true,
                            type: 'error',
                            message: 'Error al actualizar el nombre de la empresa.',
                            title: 'Error'
                          });
                        } finally {
                          setIsSavingCompanyName(false);
                        }
                      }}
                      disabled={isSavingCompanyName}
                      className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {isSavingCompanyName ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Guardar Cambios
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cuenta & Seguridad */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center">
                  <Shield size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Cuenta & Seguridad</h3>
                  <p className="text-sm text-gray-500">Información de tu cuenta y configuración de seguridad.</p>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre del Administrador</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-gray-50 focus:bg-white transition-colors text-gray-900 font-medium"
                    placeholder="Nombre del administrador"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none bg-gray-50 focus:bg-white transition-colors text-gray-900 font-medium"
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Para cambiar tu contraseña o realizar cambios adicionales en tu cuenta, contacta con el soporte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowExportModal(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-fade-in-up z-10">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mb-4">
                <Filter size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Exportar Datos</h3>
              <p className="text-gray-500 text-sm mt-1">Selecciona los filtros para tu reporte.</p>
            </div>

            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Formato de Exportación</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold text-sm ${exportFormat === 'excel'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold text-sm ${exportFormat === 'csv'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* Filter: Range Type */}
              <div className="space-y-3">
                <label
                  onClick={() => setExportFilterType('all')}
                  className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors ${exportFilterType === 'all'
                    ? 'border-primary-500 bg-primary-50/30'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${exportFilterType === 'all' ? 'border-primary-600' : 'border-gray-300'
                    }`}>
                    {exportFilterType === 'all' && (
                      <div className="w-2.5 h-2.5 bg-primary-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-semibold text-xs sm:text-sm ${exportFilterType === 'all' ? 'text-gray-900' : 'text-gray-600'
                    }`}>Toda la base de datos</span>
                </label>

                <label
                  onClick={() => setExportFilterType('dateRange')}
                  className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors ${exportFilterType === 'dateRange'
                    ? 'border-primary-500 bg-primary-50/30'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${exportFilterType === 'dateRange' ? 'border-primary-600' : 'border-gray-300'
                    }`}>
                    {exportFilterType === 'dateRange' && (
                      <div className="w-2.5 h-2.5 bg-primary-600 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-medium text-xs sm:text-sm ${exportFilterType === 'dateRange' ? 'text-gray-900' : 'text-gray-600'
                    }`}>Filtrar por rango de fechas</span>
                </label>
              </div>

              {/* Date Range Filter */}
              {exportFilterType === 'dateRange' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha Inicio</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="date"
                        value={dateRangeStart}
                        onChange={(e) => setDateRangeStart(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha Fin</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Filter: Salary Range */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rango Salarial (Opcional)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <select
                    value={exportSalaryRange}
                    onChange={(e) => setExportSalaryRange(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 appearance-none cursor-pointer hover:bg-white transition-colors text-gray-700 font-medium"
                  >
                    <option value="">Cualquier Salario</option>
                    <option value="0-3000">Menos de $3,000</option>
                    <option value="3000-5000">$3,000 - $5,000</option>
                    <option value="5000-8000">$5,000 - $8,000</option>
                    <option value="8000-12000">$8,000 - $12,000</option>
                    <option value="12000+">Más de $12,000</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              <button
                onClick={handleExport}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex justify-center items-center gap-2"
              >
                <Download size={18} /> Descargar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Prospect Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedProspect(null)}
          ></div>
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fade-in-up z-10 m-4">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-indigo-400 to-purple-400 rounded-t-[2rem] p-4 sm:p-6 pr-16 sm:pr-20 relative">
              <button
                onClick={() => setSelectedProspect(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors z-10 hover:opacity-70"
              >
                <X size={10} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-8">
              {/* Prospect Header */}
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center text-xl sm:text-2xl font-bold text-gray-600 shrink-0 mx-auto sm:mx-0">
                  {selectedProspect.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{selectedProspect.name}</h2>
                </div>
              </div>

              {/* Financial Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-primary-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Ingresos</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(selectedProspect.income)}/mes
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={18} className="text-primary-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Busca</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedProspect.propertyType || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={18} className="text-primary-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Presupuesto</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    ~{formatCurrency(selectedProspect.result?.maxPropertyPrice || 0)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle size={18} className="text-primary-600" />
                    <span className="text-xs text-gray-500 font-semibold uppercase">Teléfono</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedProspect.phone || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Zone of Interest */}
              <div className="bg-primary-50/50 p-6 rounded-2xl border border-primary-100 mb-8">
                <h3 className="text-sm font-bold text-gray-700 mb-3">INTERESADO EN</h3>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {(() => {
                      const zones = Array.isArray(selectedProspect.zone)
                        ? selectedProspect.zone
                        : (typeof selectedProspect.zone === 'string' ? [selectedProspect.zone] : []);

                      if (zones.length === 0) {
                        return (
                          <>
                            <p className="text-xl font-bold text-gray-900 mb-1">Sin zona</p>
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin size={14} />
                              <span>Panamá, Ciudad de Panamá</span>
                            </div>
                          </>
                        );
                      }

                      return (
                        <>
                          <p className="text-xl font-bold text-gray-900 mb-1">
                            {zones.join(', ')}
                          </p>
                          <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <MapPin size={14} />
                            <span>Panamá, Ciudad de Panamá</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Documents Section - MUY IMPORTANTE */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileTextIcon size={20} className="text-primary-600" />
                  Documentación
                </h3>
                {loadingProspectDocuments ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={32} className="animate-spin text-primary-500" />
                      <p className="text-sm text-gray-500">Cargando documentos...</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Foto de Cédula */}
                    {selectedProspect.idFileBase64 && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Foto de Cédula / ID</h4>
                        <div
                          onClick={() => setSelectedDocument({
                            type: selectedProspect.idFileBase64!.startsWith('data:image/') || selectedProspect.idFileBase64!.startsWith('http') ? 'image' : 'pdf',
                            url: selectedProspect.idFileBase64!,
                            name: 'Foto de Cédula / ID'
                          })}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {(selectedProspect.idFileBase64.startsWith('data:image/') || selectedProspect.idFileBase64.startsWith('http')) ? (
                            <img
                              src={selectedProspect.idFileBase64}
                              alt="Cédula"
                              className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                            />
                          ) : (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                              <FileTextIcon size={32} className="text-primary-600 mx-auto mb-2" />
                              <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ficha de Seguro Social */}
                    {selectedProspect.fichaFileBase64 && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Ficha de Seguro Social</h4>
                        <div
                          onClick={() => setSelectedDocument({
                            type: selectedProspect.fichaFileBase64!.startsWith('data:image/') || selectedProspect.fichaFileBase64!.startsWith('http') ? 'image' : 'pdf',
                            url: selectedProspect.fichaFileBase64!,
                            name: 'Ficha de Seguro Social'
                          })}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {(selectedProspect.fichaFileBase64.startsWith('data:image/') || selectedProspect.fichaFileBase64.startsWith('http')) ? (
                            <img
                              src={selectedProspect.fichaFileBase64}
                              alt="Ficha Seguro Social"
                              className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                            />
                          ) : (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                              <FileTextIcon size={32} className="text-primary-600 mx-auto mb-2" />
                              <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Talonario de Pago */}
                    {selectedProspect.talonarioFileBase64 && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Talonario de Pago</h4>
                        <div
                          onClick={() => setSelectedDocument({
                            type: selectedProspect.talonarioFileBase64!.startsWith('data:image/') || selectedProspect.talonarioFileBase64!.startsWith('http') ? 'image' : 'pdf',
                            url: selectedProspect.talonarioFileBase64!,
                            name: 'Talonario de Pago'
                          })}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {(selectedProspect.talonarioFileBase64.startsWith('data:image/') || selectedProspect.talonarioFileBase64.startsWith('http')) ? (
                            <img
                              src={selectedProspect.talonarioFileBase64}
                              alt="Talonario"
                              className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                            />
                          ) : (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                              <FileTextIcon size={32} className="text-primary-600 mx-auto mb-2" />
                              <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* APC Firmada */}
                    {selectedProspect.signedAcpFileBase64 && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">APC Firmada</h4>
                        <div
                          onClick={() => setSelectedDocument({
                            type: selectedProspect.signedAcpFileBase64!.startsWith('data:image/') || selectedProspect.signedAcpFileBase64!.startsWith('http') ? 'image' : 'pdf',
                            url: selectedProspect.signedAcpFileBase64!,
                            name: 'APC Firmada'
                          })}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {(selectedProspect.signedAcpFileBase64.startsWith('data:image/') || selectedProspect.signedAcpFileBase64.startsWith('http')) ? (
                            <img
                              src={selectedProspect.signedAcpFileBase64}
                              alt="APC Firmada"
                              className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                            />
                          ) : (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                              <FileTextIcon size={32} className="text-primary-600 mx-auto mb-2" />
                              <p className="text-xs text-center text-gray-600">Click para ver PDF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mensaje si no hay documentos */}
                    {!selectedProspect.idFileBase64 && !selectedProspect.fichaFileBase64 &&
                      !selectedProspect.talonarioFileBase64 && !selectedProspect.signedAcpFileBase64 && (
                        <div className="col-span-2 text-center py-8 text-gray-400">
                          <FileTextIcon size={48} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay documentos subidos</p>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Interés en Propiedades Section */}
              {prospectInterestedProperties.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart size={20} className="text-pink-500" />
                    Interés en Propiedades
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {prospectInterestedProperties.map((property) => (
                      <div
                        key={property.id}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      >
                        {/* Imagen */}
                        <div className="relative h-40 bg-gray-100 overflow-hidden">
                          {property.images && property.images.length > 0 ? (
                            <img
                              src={property.images[0]}
                              alt={property.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                              <Building size={32} className="text-primary-300" />
                            </div>
                          )}
                          <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white ${property.type === 'Venta' ? 'bg-purple-600' : 'bg-green-600'
                            }`}>
                            {property.type}
                          </div>
                        </div>

                        {/* Contenido */}
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 mb-2 text-sm line-clamp-1">{property.title}</h4>
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-3">
                            <MapPin size={12} />
                            <span className="truncate">{property.zone}</span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                            {property.bedrooms && (
                              <div className="flex items-center gap-1">
                                <BedDouble size={14} className="text-gray-400" />
                                <span>{property.bedrooms}</span>
                              </div>
                            )}
                            {property.bathrooms && (
                              <div className="flex items-center gap-1">
                                <Bath size={14} className="text-gray-400" />
                                <span>{property.bathrooms}</span>
                              </div>
                            )}
                            {property.areaM2 && (
                              <span className="text-gray-400">
                                {property.areaM2}m²
                              </span>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Precio</div>
                            <div className="text-lg font-bold text-primary-600">{formatCurrency(property.price)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state for properties */}
              {!isPromotora && isLoadingProspectProperties && (
                <div className="mb-8 text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="text-gray-500 mt-3 text-sm">Cargando propiedades de interés...</p>
                </div>
              )}

              {/* Interés en Modelos de Proyectos Section (Promotora) */}
              {prospectInterestedModels.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart size={20} className="text-pink-500" />
                    Interés en Modelos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {prospectInterestedModels.map(({ model, project }) => (
                      <div
                        key={model.id}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      >
                        {/* Imagen */}
                        <div className="relative h-40 bg-gray-100 overflow-hidden">
                          {model.images && model.images.length > 0 ? (
                            <img
                              src={model.images[0]}
                              alt={model.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : project.images && project.images.length > 0 ? (
                            <img
                              src={project.images[0]}
                              alt={project.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                              <Building size={32} className="text-primary-300" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold text-white bg-primary-600">
                            {formatCurrency(model.price)}
                          </div>
                        </div>

                        {/* Contenido */}
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 mb-1 text-sm line-clamp-1">{model.name}</h4>
                          <p className="text-xs text-gray-500 mb-3">{project.name}</p>
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-3">
                            <MapPin size={12} />
                            <span className="truncate">{project.zone || 'Zona no especificada'}</span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                            {model.bedrooms && (
                              <div className="flex items-center gap-1">
                                <BedDouble size={14} className="text-gray-400" />
                                <span>{model.bedrooms}</span>
                              </div>
                            )}
                            {model.bathrooms && (
                              <div className="flex items-center gap-1">
                                <Bath size={14} className="text-gray-400" />
                                <span>{model.bathrooms}</span>
                              </div>
                            )}
                            {model.areaM2 && (
                              <span className="text-gray-400">
                                {model.areaM2}m²
                              </span>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Disponibilidad</div>
                            <div className="text-sm font-semibold text-green-600">
                              {model.unitsAvailable} {model.unitsAvailable === 1 ? 'unidad' : 'unidades'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state for models */}
              {isLoadingProspectModels && (
                <div className="mb-8 text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="text-gray-500 mt-3 text-sm">Cargando modelos de interés...</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDocument(null)}
          ></div>
          <div className="bg-white rounded-[2rem] w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10 flex flex-col m-4">
            {/* Header */}
            <div className="bg-gray-900 text-white p-4 sm:p-6 flex items-center justify-between gap-4">
              <h3 className="text-sm sm:text-lg font-bold truncate">{selectedDocument.name}</h3>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  onClick={() => {
                    // Función para descargar
                    const link = document.createElement('a');
                    link.href = selectedDocument.url;

                    // Determinar extensión y nombre del archivo
                    let extension = '';
                    let mimeType = '';

                    if (selectedDocument.type === 'image') {
                      // Extraer el tipo MIME de la data URL
                      const mimeMatch = selectedDocument.url.match(/data:([^;]+);/);
                      mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

                      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
                        extension = '.jpg';
                      } else if (mimeType.includes('png')) {
                        extension = '.png';
                      } else if (mimeType.includes('gif')) {
                        extension = '.gif';
                      } else {
                        extension = '.png';
                      }
                    } else {
                      // PDF
                      extension = '.pdf';
                      mimeType = 'application/pdf';
                    }

                    // Crear nombre de archivo
                    const fileName = `${selectedDocument.name.replace(/\s+/g, '_')}${extension}`;

                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 flex items-center gap-2 transition-colors text-xs sm:text-sm font-semibold"
                >
                  <Download size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-50">
              {selectedDocument.type === 'image' ? (
                <img
                  src={selectedDocument.url}
                  alt={selectedDocument.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <iframe
                  src={selectedDocument.url}
                  className="w-full h-[70vh] rounded-lg border border-gray-200 shadow-lg bg-white"
                  title={selectedDocument.name}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Selección: Manual o Importar (Solo para Propiedades/Broker) */}
      {showPropertySelectionModal && !isPromotora && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">

            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none"></div>

            {/* Close Button */}
            <button
              onClick={() => setShowPropertySelectionModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-20"
            >
              <X size={20} className="text-gray-600" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center mb-12">
              {/* Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary-200 transform rotate-3 hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl font-bold text-white tracking-tighter">ê</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Agregar Propiedades</h1>
              <p className="text-gray-500 text-lg leading-relaxed max-w-lg mx-auto font-light">
                Elige cómo deseas agregar propiedades a tu catálogo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              {/* Botón: Agregar Manualmente */}
              <button
                onClick={() => {
                  setShowPropertySelectionModal(false);
                  setTimeout(() => {
                    setSelectedPropertyForEdit(null);
                    setShowPropertyModal(true);
                  }, 300);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300">
                  <Plus size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Agregar Propiedad Manual</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4">
                  Crea una propiedad nueva completando el formulario paso a paso.
                </p>

                <div className="flex items-center gap-2 text-primary-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Comenzar ahora <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>

              {/* Botón: Importar desde Excel/CSV */}
              <button
                onClick={() => {
                  // Trigger file input
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await handleImportProperties(file);
                      setShowPropertySelectionModal(false);
                    }
                  };
                  input.click();
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-gray-50/30 hover:border-purple-500 hover:bg-purple-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-purple-200 group-hover:bg-white group-hover:text-purple-600 transition-all duration-300 group-hover:scale-110">
                  <Download size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-900 transition-colors">Importar Propiedades</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4 group-hover:text-gray-600 transition-colors">
                  Importa múltiples propiedades desde un archivo Excel o CSV.
                </p>

                <div className="flex items-center gap-2 text-purple-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Seleccionar archivo <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl -mr-16 -mb-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear/Editar Propiedad (Broker) */}
      {showPropertyModal && !isPromotora && (
        <PropertyModal
          property={selectedPropertyForEdit}
          companyId={localStorage.getItem('companyId') || ''}
          zones={availableZones}
          onClose={() => {
            setShowPropertyModal(false);
            setSelectedPropertyForEdit(null);
          }}
          onSave={async (propertyData) => {
            const companyId = localStorage.getItem('companyId');
            if (!companyId) return;

            if (selectedPropertyForEdit) {
              // Actualizar
              await updateProperty(selectedPropertyForEdit.id, propertyData);
            } else {
              // Crear
              await saveProperty({ ...propertyData, companyId });
            }

            // Recargar propiedades
            const props = await getPropertiesByCompany(companyId);
            setProperties(props);
            setShowPropertyModal(false);
            setSelectedPropertyForEdit(null);
          }}
        />
      )}

      {/* Modal de Selección: Manual o Importar (Proyectos) */}
      {showProjectSelectionModal && isPromotora && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] w-full max-w-4xl animate-fade-in-up border border-white/50 backdrop-blur-sm relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-60 pointer-events-none"></div>

            {/* Close Button */}
            <button
              onClick={() => setShowProjectSelectionModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-20"
            >
              <X size={20} className="text-gray-600" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center mb-12">
              {/* Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary-200 transform rotate-3 hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl font-bold text-white tracking-tighter">ê</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Agregar Proyectos</h1>
              <p className="text-gray-500 text-lg leading-relaxed max-w-lg mx-auto font-light">
                Elige cómo deseas agregar proyectos a tu catálogo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              {/* Botón: Agregar Manualmente */}
              <button
                onClick={() => {
                  setShowProjectSelectionModal(false);
                  setTimeout(() => {
                    setSelectedProjectForEdit(null);
                    setShowProjectModal(true);
                  }, 300);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 text-gray-900 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300">
                  <Plus size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Agregar Proyecto Manual</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4">
                  Crea un proyecto nuevo completando el formulario paso a paso.
                </p>

                <div className="flex items-center gap-2 text-primary-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Comenzar ahora <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>

              {/* Botón: Importar desde Excel/CSV */}
              <button
                onClick={() => {
                  // TODO: Implementar importación de proyectos
                  setNotification({
                    isOpen: true,
                    type: 'info',
                    message: 'La importación de proyectos estará disponible pronto',
                    title: 'Próximamente'
                  });
                  setShowProjectSelectionModal(false);
                }}
                className="group text-left p-8 rounded-[2.5rem] border-2 border-gray-100 bg-gray-50/30 hover:border-purple-500 hover:bg-purple-50/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-purple-200 group-hover:bg-white group-hover:text-purple-600 transition-all duration-300 group-hover:scale-110">
                  <Download size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-900 transition-colors">Importar Proyectos</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4 group-hover:text-gray-600 transition-colors">
                  Importa múltiples proyectos desde un archivo Excel o CSV.
                </p>

                <div className="flex items-center gap-2 text-purple-600 font-bold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Seleccionar archivo <ArrowRight size={16} />
                </div>

                {/* Decoración sutil en hover */}
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl -mr-16 -mb-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear/Editar Proyecto (Promotora) */}
      {showProjectModal && isPromotora && (
        <ProjectModal
          project={selectedProjectForEdit}
          companyId={localStorage.getItem('companyId') || ''}
          zones={availableZones}
          onClose={() => {
            setShowProjectModal(false);
            setSelectedProjectForEdit(null);
          }}
          onSave={async (projectData) => {
            const companyId = localStorage.getItem('companyId');
            if (!companyId) return;

            if (selectedProjectForEdit) {
              // Actualizar
              await updateProject(selectedProjectForEdit.id, projectData);
            } else {
              // Crear
              await saveProject({ ...projectData, companyId });
            }

            // Recargar proyectos
            const projs = await getProjectsByCompany(companyId);
            setProjects(projs);
            setShowProjectModal(false);
            setSelectedProjectForEdit(null);
          }}
        />
      )}

      {/* Mobile Floating Navbar */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-2 flex justify-between items-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}
          >
            <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Dash</span>
          </button>

          <button
            onClick={() => setActiveTab('prospects')}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all ${activeTab === 'prospects' ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}
          >
            <Users size={20} strokeWidth={activeTab === 'prospects' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Prospectos</span>
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all ${activeTab === 'properties' ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}
          >
            <Building size={20} strokeWidth={activeTab === 'properties' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">{isPromotora ? 'Proy' : 'Prop'}</span>
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all relative ${activeTab === 'campaigns' ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}
          >
            <MessageCircle size={20} strokeWidth={activeTab === 'campaigns' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1 relative">Campañas</span>
            <span className="absolute top-0 right-0 text-white text-[6px] font-black px-1 py-0.5 rounded-full shadow-sm border border-white/50" style={{ background: 'linear-gradient(135deg, #29BEA5 0%, #1fa890 100%)' }}>NUEVO</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all ${(activeTab === 'settings' || activeTab === 'calculator-config') ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}
          >
            <Settings size={20} strokeWidth={(activeTab === 'settings' || activeTab === 'calculator-config') ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Ajustes</span>
          </button>
        </div>
      </div>

      {/* Modal de Zonas más buscadas */}
      {showZonesModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowZonesModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 10000 }}
          >
            {/* Header con botón cerrar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <MapPin size={20} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Zonas Más Buscadas</h3>
                  <p className="text-sm text-gray-500">Zonas más populares entre los prospectos</p>
                </div>
              </div>
              <button
                onClick={() => setShowZonesModal(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <div className="space-y-4">
                {sortedZones.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aún no tenemos datos de zonas
                  </div>
                ) : (
                  sortedZones.map(([zone, count], index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <MapPin size={18} className="text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{zone}</h4>
                        <p className="text-sm text-gray-500">
                          {count} {count === 1 ? 'prospecto interesado' : 'prospectos interesados'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {sortedZones.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 text-center">
                    Total: <span className="font-bold text-gray-900">{totalZones}</span> {totalZones === 1 ? 'zona encontrada' : 'zonas encontradas'} con actividad
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        message={notification.message}
        title={notification.title}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </>
  );
};