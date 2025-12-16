import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    className = '',
    disabled,
    ...props
}) => {

    const baseStyle = "relative inline-flex items-center justify-center px-6 py-3 text-sm font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transform active:scale-[0.97]";

    const variants = {
        primary: "bg-primary-600 hover:bg-primary-700 text-white shadow-xl shadow-primary-500/20 focus:ring-primary-100 border border-transparent hover:-translate-y-0.5",
        secondary: "bg-white hover:bg-calm-50 text-calm-800 shadow-sm border border-calm-200 focus:ring-calm-100 hover:shadow-md",
        ghost: "bg-transparent hover:bg-calm-100 text-calm-500 hover:text-calm-800 focus:ring-calm-100",
        outline: "bg-transparent border-2 border-primary-100 text-primary-600 hover:border-primary-200 hover:bg-primary-50 focus:ring-primary-50"
    };

    return (
        <button
            className={`${baseStyle} ${variants[variant]} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-bold">Procesando...</span>
                </span>
            ) : children}
        </button>
    );
};
