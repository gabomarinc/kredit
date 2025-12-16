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

export interface Prospect {
  id: string;
  companyId?: string | null;
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
  // URLs de archivos en Google Drive (opcionalmente retornados por getProspectDocuments)
  idFileDriveUrl?: string | null;
  fichaFileDriveUrl?: string | null;
  talonarioFileDriveUrl?: string | null;
  signedAcpFileDriveUrl?: string | null;
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