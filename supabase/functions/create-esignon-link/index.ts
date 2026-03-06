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
                    { name: "Label_0", value: String(orderDetails.rate || 0) }, // 예약 공급형 매입 시세 (숫자만)
                    { name: "Check_0", value: orderDetails.voucherType === 'lotte_tomorrow' ? "1" : "0" }, // 유형 a선택했으면 Check_0 체크
                    { name: "Check_1", value: orderDetails.voucherType === 'lotte_custom' ? "1" : "0" }, // b선택했으면 Check_1 체크
                    { name: "Label_1", value: orderDetails.account_number || "" }, // 계좌번호
                    { name: "DateTime_1", value: orderDetails.expected_date || "" }, // 예약일
                    { name: "Label_3", value: String(orderDetails.amount || 0) }, // 판매금액(액면가)
                    { name: "Check_2", value: "1" }, // 체크 고정
                    { name: "Check_5", value: "1" }, // 체크 고정
                    { name: "Check_7", value: "1" }, // 체크 고정
                    { name: "Check_9", value: "1" }, // 체크 고정
                    { name: "DateTime_0", value: new Date().toISOString().split('T')[0] }, // 계약일
                    { name: "Label_4", value: orderDetails.applicant_name || "" }, // 이름
                    { name: "Label_5", value: orderDetails.phone || "" }, // 연락처
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
