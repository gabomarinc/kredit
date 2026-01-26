export enum PropertyType {
  House = 'Casa',
  Apartment = 'Apartamento'
}

export interface UserPreferences {
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  zone: string[];
}

export interface FinancialData {
  familyIncome: number;
}

export interface PersonalData {
  fullName: string;
  email: string;
  phone: string;
  idFile: File | null;
  fichaFile: File | null;
  talonarioFile: File | null;
  signedAcpFile: File | null;
}

export interface CalculationResult {
  maxPropertyPrice: number;
  monthlyPayment: number;
  downPaymentPercent: number;
  downPaymentAmount: number;
}

export interface FormConfig {
  requestedDocuments?: {
    idFile: boolean;
    fichaFile: boolean;
    talonarioFile: boolean;
    signedAcpFile: boolean;
  };
  apcDocumentId?: string; // Google Drive ID
  zones?: string[];
}

export interface Form {
  id: string;
  companyId: string;
  name: string;
  config?: FormConfig;
  createdAt: string;
}

export interface Prospect {
  id: string;
  companyId?: string | null;
  formId?: string | null; // Nuevo campo para vincular con un formulario
  formName?: string; // Campo virtual para mostrar en UI
  name: string;
  email: string;
  phone?: string;
  income: number;
  date: string; // ISO string para filtros
  dateDisplay?: string; // Formato legible para mostrar
  status: 'Nuevo' | 'Contactado' | 'En Proceso';
  propertyType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  zone: string | string[]; // Puede ser string o array
  result: CalculationResult;
  // Archivos en Base64 (pueden ser imágenes o PDFs)
  idFileBase64?: string | null;
  fichaFileBase64?: string | null;
  talonarioFileBase64?: string | null;
  signedAcpFileBase64?: string | null;
}

// ============================================
// SISTEMA DE PLANES
// ============================================
export type PlanType = 'Freshie' | 'Wolf of Wallstreet';
export type RoleType = 'Promotora' | 'Broker';

// ============================================
// SISTEMA DE PROPIEDADES
// ============================================
export type PropertyListingType = 'Venta' | 'Alquiler';
export type PropertyStatus = 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada';

export interface Property {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  type: PropertyListingType;
  price: number;
  zone: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  images: string[]; // Array de Base64 strings
  address?: string;
  features?: string[];
  status: PropertyStatus;
  highDemand?: boolean;
  demandVisits?: number;
  priceAdjusted?: boolean;
  priceAdjustmentPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyInterest {
  id: string;
  prospectId: string;
  propertyId: string;
  interested: boolean;
  createdAt?: string;
  property?: Property; // Populated when fetching interests with property details
  prospect?: Prospect; // Populated when fetching interests with prospect details
}

// ============================================
// SISTEMA DE PROYECTOS (PROMOTORA)
// ============================================
export type ProjectStatus = 'Activo' | 'Inactivo';

export interface ProjectModel {
  id?: string;
  name: string;
  areaM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  amenities?: string[];
  unitsTotal: number;
  unitsAvailable: number;
  price: number;
  images: string[]; // Array de Base64 strings
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  zone: string;
  address?: string;
  images: string[]; // Array de Base64 strings
  status: ProjectStatus;
  models: ProjectModel[]; // Modelos dentro del proyecto
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// SISTEMA DE EMPRESAS Y USUARIOS
// ============================================

export interface CompanyData {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  logoUrl?: string; // base64
  zones?: string[];
  role?: RoleType;
  googleDriveAccessToken?: string;
  googleDriveRefreshToken?: string;
  googleDriveFolderId?: string;
  notificationEmail?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  companyName: string;
  logoUrl?: string;
  zones: string[];
  plan?: PlanType;
  role?: RoleType;
  googleDriveAccessToken?: string;
  googleDriveRefreshToken?: string;
  googleDriveFolderId?: string;
  apcDocumentDriveId?: string;
  requestedDocuments?: {
    idFile: boolean;
    fichaFile: boolean;
    talonarioFile: boolean;
    signedAcpFile: boolean;
  };
  notificationEmail?: string;
  createdAt?: string;
}