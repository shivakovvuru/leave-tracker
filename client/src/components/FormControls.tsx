import React from 'react';

type BtnProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: React.ReactNode;
};

export const Button: React.FC<BtnProps> = ({
  children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, icon,
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`btn btn-${variant} btn-${size}`}
  >
    {icon && <span className="btn-icon">{icon}</span>}
    {children}
  </button>
);

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
};

export const Field: React.FC<FieldProps> = ({ label, children, required, hint }) => (
  <label className="field">
    <div className="field-label">
      {label}
      {required && <span className="field-required">*</span>}
    </div>
    {children}
    {hint && <div className="field-hint">{hint}</div>}
  </label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`input ${props.className || ''}`} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={`textarea ${props.className || ''}`} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`select ${props.className || ''}`} />
);

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
};
export const Badge: React.FC<BadgeProps> = ({ children, tone = 'default' }) => (
  <span className={`badge badge-${tone}`}>{children}</span>
);

export const EmptyState: React.FC<{ image?: string; title: string; subtitle?: string; action?: React.ReactNode }> = ({
  image, title, subtitle, action,
}) => (
  <div className="empty-state">
    {image && <img src={image} alt="" className="empty-state-img" />}
    <h3>{title}</h3>
    {subtitle && <p>{subtitle}</p>}
    {action}
  </div>
);
