import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESIGNON_DOMAIN = "https://docs.esignon.net";
const COMPANY_ID = Deno.env.get("ESIGNON_COMPANY_ID") || "naver0ksiboy22";
const MEMB_EMAIL = Deno.env.get("ESIGNON_EMAIL") || "ksiboy22@naver.com";
const MEMB_PWD = Deno.env.get("ESIGNON_PWD") || "dkfqhd21!!";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { workflowId } = await req.json();

        if (!workflowId) {
            throw new Error("workflowId is required");
        }

        // ① 인증 토큰 발급
        const tokenRes = await fetch(`${ESIGNON_DOMAIN}/api/${COMPANY_ID}/login`, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                header: { request_code: "1001Q" },
                body: {
                    memb_email: MEMB_EMAIL,
                    memb_pwd: MEMB_PWD,
                },
            }),
        });

        const tokenData = await tokenRes.json();

        if (tokenData?.header?.result_code !== "00") {
            throw new Error(`eSignon 인증 실패: ${tokenData?.header?.result_msg}`);
        }

        const accessToken = tokenData.body.access_token;

        // ② 문서 상세 조회로 상태 확인
        const detailRes = await fetch(`${ESIGNON_DOMAIN}/api/v3/workflows/${workflowId}`, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Authorization": `esignon ${accessToken}`,
            },
        });

        const detailData = await detailRes.json();
        console.log("eSignon status response:", JSON.stringify(detailData));

        // eSignon status types: WORKFLOW_START, SIGN_REQ, Playing, Complete, REJECT, CANCEL
        const status = detailData?.status || detailData?.workflow_status;
        const statusUpper = String(status || '').toUpperCase();
        const isComplete = statusUpper === 'COMPLETE' || statusUpper === 'COMPLETED';

        return new Response(
            JSON.stringify({
                status,
                isComplete,
                workflowId
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("eSignon Error:", error);
        return new Response(
            JSON.stringify({ error: error.message, isComplete: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
    }
});
