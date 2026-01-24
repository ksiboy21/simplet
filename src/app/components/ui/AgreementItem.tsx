import React, { useState } from 'react';
import { Checkbox } from './TossComponents';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgreementItemProps {
    title: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    className?: string;
    content?: string;
    defaultOpen?: boolean;
}

export const AgreementItem = ({ title, checked, onChange, className, content, defaultOpen = false }: AgreementItemProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <Checkbox
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    label={title}
                    className="flex-1 m-0 p-0 hover:bg-transparent"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <ChevronDown className={cn("w-5 h-5 transition-transform", isOpen && "rotate-180")} />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-gray-50 rounded-xl p-4 text-[13px] text-gray-600 space-y-2 leading-relaxed border border-gray-100">
                            <p className="font-semibold text-gray-800">{title}</p>
                            {content ? (
                                <p className="whitespace-pre-wrap">{content}</p>
                            ) : (
                                <p className="text-gray-400 italic">내용이 없습니다.</p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
