import { Order } from '@/lib/supabase';
import { TermsState } from '@/lib/useMockData'; // Or wherever TermsState is defined
import { Button } from './ui/TossComponents';
import { X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface ContractModalProps {
    order: Order;
    terms: TermsState;
    onClose: () => void;
}

export const ContractModal = ({ order, terms, onClose }: ContractModalProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const content = (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in portal-print-root">
            {/* Search for "contract-print-content" in index.css for print styles */}
            <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[24px] shadow-xl flex flex-col overflow-hidden contract-modal-container">

                {/* Header - Hidden on Print if desired, or kept */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white contract-modal-header">
                    <h2 className="text-lg font-bold text-[#191F28]">전자계약서 조회</h2>
                    <div className="flex gap-2">
                        <Button onClick={handlePrint} className="bg-[#0064FF] text-white flex gap-2 items-center h-10 px-4 rounded-lg hover:bg-[#0052CC]">
                            <Download size={18} />
                            PDF 다운로드 (인쇄)
                        </Button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50 printable-content" id="printable-contract">
                    <div className="bg-white p-10 shadow-sm border border-gray-200 rounded-none max-w-[210mm] mx-auto min-h-[297mm]">

                        {/* Contract Title */}
                        <div className="text-center mb-12">
                            <h1 className="text-3xl font-extrabold text-[#191F28] mb-2">상품권 매입 신청서 및 계약서</h1>
                            <p className="text-gray-500 text-sm">Document No. {order.id.toString().slice(0, 8).toUpperCase()}</p>
                        </div>

                        {/* Section 1: Order Info */}
                        <div className="mb-10">
                            <h3 className="text-lg font-bold text-[#191F28] border-b-2 border-black pb-2 mb-4">1. 신청 정보</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 font-semibold text-gray-600 w-32 bg-gray-50 px-3">신청일자</td>
                                        <td className="py-3 text-gray-900 px-3">{format(new Date(order.created_at), 'yyyy년 MM월 dd일')}</td>
                                        <td className="py-3 font-semibold text-gray-600 w-32 bg-gray-50 px-3">신청자</td>
                                        <td className="py-3 text-gray-900 px-3">{order.applicant_name} ({order.phone})</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">상품명</td>
                                        <td className="py-3 text-gray-900 px-3">{order.name}</td>
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">신청금액</td>
                                        <td className="py-3 text-gray-900 px-3">{order.amount?.toLocaleString()}원</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">적용시세</td>
                                        <td className="py-3 text-gray-900 px-3">{order.rate}%</td>
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">지급예정금액</td>
                                        <td className="py-3 text-gray-900 font-bold px-3">{order.deposit?.toLocaleString()}원</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">계좌정보</td>
                                        <td className="py-3 text-gray-900 px-3" colSpan={3}>
                                            {order.bank_name} {order.account_number}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 font-semibold text-gray-600 bg-gray-50 px-3">예약희망일</td>
                                        <td className="py-3 text-gray-900 px-3" colSpan={3}>{order.expected_date}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 2: Terms */}
                        <div className="mb-10">
                            <h3 className="text-lg font-bold text-[#191F28] border-b-2 border-black pb-2 mb-4">2. 약관 동의 내역</h3>
                            <div className="space-y-6">
                                {/* Fixed Terms if legacy, but relying on terms passed */}
                                <div className="space-y-4">
                                    {/* Render dynamic items if they exist */}
                                    {terms?.reserve?.items?.map((item, idx) => (
                                        <div key={item.id} className="text-sm">
                                            <h4 className="font-bold text-gray-800 mb-1">[{idx + 1}] {item.title}</h4>
                                            <div className="text-gray-600 bg-gray-50 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">
                                                {item.content}
                                            </div>
                                            <div className="mt-1 text-right text-xs text-[#0064FF] font-semibold">
                                                ✓ 동의함 ({format(new Date(order.created_at), 'yyyy-MM-dd')})
                                            </div>
                                        </div>
                                    ))}

                                    {/* Fallback for legacy static terms if items empty */}
                                    {(!terms?.reserve?.items || terms.reserve.items.length === 0) && (
                                        <>
                                            <div className="text-sm">
                                                <h4 className="font-bold text-gray-800 mb-1">1. {terms.reserve.responsibilityTitle}</h4>
                                                <div className="text-gray-600 bg-gray-50 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">
                                                    {terms.reserve.responsibility}
                                                </div>
                                                <div className="mt-1 text-right text-xs text-[#0064FF] font-semibold">
                                                    ✓ 동의함
                                                </div>
                                            </div>
                                            <div className="text-sm">
                                                <h4 className="font-bold text-gray-800 mb-1">2. {terms.reserve.privacyTitle}</h4>
                                                <div className="text-gray-600 bg-gray-50 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">
                                                    {terms.reserve.privacy}
                                                </div>
                                                <div className="mt-1 text-right text-xs text-[#0064FF] font-semibold">
                                                    ✓ 동의함
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center mt-20 pt-10 border-t border-gray-200">
                            <p className="text-sm text-gray-500 mb-2">위 내용과 같이 상품권 매입 계약을 체결하였음을 증명합니다.</p>
                            <p className="text-sm text-gray-400">{format(new Date(order.created_at), 'yyyy년 MM월 dd일')}</p>
                            <p className="text-lg font-bold text-[#191F28] mt-2">심플티켓 (SimpleTicket)</p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(content, document.body);
};
