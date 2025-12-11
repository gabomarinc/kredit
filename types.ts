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