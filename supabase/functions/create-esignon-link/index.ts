// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { orderDetails } = await req.json();

        const ESIGNON_CLIENT_ID = Deno.env.get("ESIGNON_CLIENT_ID");
        const ESIGNON_CLIENT_SECRET = Deno.env.get("ESIGNON_CLIENT_SECRET");
        const ESIGNON_TEMPLATE_ID = Deno.env.get("ESIGNON_TEMPLATE_ID");

        if (!ESIGNON_CLIENT_ID || !ESIGNON_CLIENT_SECRET || !ESIGNON_TEMPLATE_ID) {
            throw new Error("서버 환경 변수에 eSignon 인증 정보가 누락되었습니다.");
        }

        // 1. Get Authentication Token
        const tokenResponse = await fetch("https://docs.esignon.net/api/v3/maketoken", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: ESIGNON_CLIENT_ID,
                client_secret: ESIGNON_CLIENT_SECRET,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`eSignon 토큰 발급 실패: ${errorText}`);
        }

        const { access_token } = await tokenResponse.json();

        // 2. Create Linksign
        // Note: The payload here uses typical standard parameters, which may need adjustment 
        // depending on the exact eSignon template settings.
        const linksignResponse = await fetch("https://docs.esignon.net/api/v3/link/start", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                template_id: ESIGNON_TEMPLATE_ID,
                link_manage_name: `예약판매 계약서 - ${orderDetails.applicant_name}`,
                expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
                signers: [
                    {
                        language: "ko",
                        role: "Signer 1", // Assuming Template requires Signer 1
                    }
                ],
                // Insert dynamic fields here based on template setup
                // The exact field_name matches the text/label fields defined in the eSignon template editor.
                fields: [
                    {
                        field_name: "고객명", // Example: needs to match template
                        field_value: orderDetails.applicant_name || ""
                    },
                    {
                        field_name: "연락처",
                        field_value: orderDetails.phone || ""
                    },
                    {
                        field_name: "예약금",
                        field_value: `${orderDetails.deposit?.toLocaleString() || 0}원`
                    },
                    {
                        field_name: "상품권액면가",
                        field_value: `${orderDetails.amount?.toLocaleString() || 0}원`
                    }
                ]
            }),
        });

        if (!linksignResponse.ok) {
            const errorText = await linksignResponse.text();
            throw new Error(`eSignon 링크생성 실패: ${errorText}`);
        }

        const linkData = await linksignResponse.json();

        // eSignon typically returns the URL inside 'response' or at the root depending on v3 format.
        // Replace with exact property once it's tested.
        const contractUrl = linkData.url || linkData.link_url || (linkData.response && linkData.response.url);

        if (!contractUrl) {
            throw new Error(`계약서 URL을 응답받지 못했습니다: ${JSON.stringify(linkData)}`);
        }

        return new Response(
            JSON.stringify({ contractUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
    }
});
