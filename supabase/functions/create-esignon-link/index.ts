import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESIGNON_DOMAIN = "https://docs.esignon.net";
const COMPANY_ID = "simpleticket";
const MEMB_EMAIL = "ksiboy22@naver.com";
const MEMB_PWD = "simple21!!";
const TEMPLATE_ID = 29;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { orderDetails } = await req.json();
        // orderDetails: { applicant_name, phone, amount, deposit, rate }

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

        // ② 비대면 문서 시작 (계약서 생성)
        const workflowName = `선매입 계약서 - ${orderDetails.applicant_name}`;
        const now = new Date();
        const expiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3일 후
        const expiryStr = expiry.toISOString().replace("T", " ").substring(0, 19);

        const workflowRes = await fetch(`${ESIGNON_DOMAIN}/api/v3/workflows/start`, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "Authorization": `esignon ${accessToken}`,
            },
            body: JSON.stringify({
                workflow_name: workflowName,
                template_id: TEMPLATE_ID,
                language: "ko",
                expiry_date: expiryStr,
                is_preview: false,
                recipient_list: [
                    {
                        email: orderDetails.phone, // 휴대폰 번호 또는 이메일
                        name: orderDetails.applicant_name,
                        order: 1,
                    }
                ],
                field_list: [
                    { name: "고객명", value: orderDetails.applicant_name || "" },
                    { name: "연락처", value: orderDetails.phone || "" },
                    { name: "상품권액면가", value: `${(orderDetails.amount || 0).toLocaleString()}원` },
                    { name: "물품대금", value: `${(orderDetails.deposit || 0).toLocaleString()}원` },
                    { name: "매입률", value: `${orderDetails.rate || 0}%` },
                    { name: "Label_0", value: orderDetails.applicant_name || "" },
                    { name: "DateTime_0", value: orderDetails.expected_date || "" },
                ],
            }),
        });

        const workflowData = await workflowRes.json();

        if (!workflowData?.token) {
            throw new Error(`계약서 생성 실패: ${JSON.stringify(workflowData)}`);
        }

        // ③ 서명 URL(playing_url) 획득을 위해 문서 상세 조회
        const detailRes = await fetch(`${ESIGNON_DOMAIN}/api/v3/workflows/${workflowData.workflow_id}`, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Authorization": `esignon ${accessToken}`,
            },
        });
        const detailData = await detailRes.json();

        if (!detailData?.playing_url) {
            throw new Error("서명 진행 URL(playing_url)을 가져올 수 없습니다.");
        }

        // callback_fn=true: 서명 완료 후 부모창으로 postMessage 전송
        // next_sign=false: 다음 문서 작성하기 버튼 제거
        const signUrl = `${detailData.playing_url}&callback_fn=true&next_sign=false`;

        return new Response(
            JSON.stringify({
                signUrl,
                workflowId: workflowData.workflow_id,
                workflowName: workflowData.workflow_name,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("eSignon Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
    }
});
