'use client';

import { useState, ReactNode } from 'react';

interface AccordionProps {
    title: string;
    icon?: string;
    children: ReactNode;
    defaultOpen?: boolean;
    badge?: string;
    badgeColor?: string;
}

export default function Accordion({
    title,
    icon,
    children,
    defaultOpen = false,
    badge,
    badgeColor = 'bg-bg-card',
}: AccordionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-border-focus/30">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-bg-card hover:bg-bg-card-hover transition-colors text-left"
            >
                <div className="flex items-center gap-2.5">
                    {icon && <span className="text-lg">{icon}</span>}
                    <span className="font-semibold text-sm text-text-primary">{title}</span>
                    {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor} text-text-secondary`}>
                            {badge}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-5 h-5 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="px-4 py-4 bg-bg-secondary/50 animate-slide-down border-t border-border/50">
                    {children}
                </div>
            )}
        </div>
    );
}
