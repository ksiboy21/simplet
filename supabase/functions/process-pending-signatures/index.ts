import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESIGNON_DOMAIN = "https://docs.esignon.net";
const COMPANY_ID = Deno.env.get("ESIGNON_COMPANY_ID") || "naver0ksiboy22";
const MEMB_EMAIL = Deno.env.get("ESIGNON_EMAIL") || "ksiboy22@naver.com";
const MEMB_PWD = Deno.env.get("ESIGNON_PWD") || "dkfqhd21!!";
const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") || "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") || "";
const SOLAPI_SENDER = Deno.env.get("SOLAPI_SENDER_NUMBER") || "01000000000";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// eSignon 인증 토큰 발급
async function getEsignonToken(): Promise<string> {
    const res = await fetch(`${ESIGNON_DOMAIN}/api/${COMPANY_ID}/login`, {
        method: "POST",
        headers: { "accept": "application/json", "content-type": "application/json" },
        body: JSON.stringify({
            header: { request_code: "1001Q" },
            body: { memb_email: MEMB_EMAIL, memb_pwd: MEMB_PWD },
        }),
    });
    const data = await res.json();
    if (data?.header?.result_code !== "00") {
        throw new Error(`eSignon 인증 실패: ${data?.header?.result_msg}`);
    }
    return data.body.access_token;
}

// eSignon 워크플로우 상태 확인
async function checkWorkflowStatus(workflowId: string, accessToken: string) {
    const res = await fetch(`${ESIGNON_DOMAIN}/api/v3/workflows/${workflowId}`, {
        method: "GET",
        headers: { "accept": "application/json", "Authorization": `esignon ${accessToken}` },
    });
    const data = await res.json();
    const status = data?.status || data?.workflow_status || "";
    const statusUpper = String(status).toUpperCase();
    return {
        isComplete: statusUpper === "COMPLETE" || statusUpper === "COMPLETED",
        isCanceled: ["CANCEL", "CANCELED", "CANCELLED", "REJECT", "REJECTED"].includes(statusUpper),
    };
}

// SMS 발송 (솔라피)
async function sendSMS(to: string, text: string) {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) return;
    try {
        const date = new Date().toISOString();
        const salt = Math.random().toString(36).substring(2);
        const hmacData = date + salt;
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(SOLAPI_API_SECRET),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(hmacData));
        const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

        await fetch("https://api.solapi.com/messages/v4/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
            },
            body: JSON.stringify({
                message: { to, from: SOLAPI_SENDER, text },
            }),
        });
    } catch (e) {
        console.error("SMS 발송 실패:", e);
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // 1. 미처리 pending_signatures 전체 조회
        const { data: pendingList, error: fetchError } = await supabase
            .from("pending_signatures")
            .select("*")
            .order("created_at", { ascending: true });

        if (fetchError) throw fetchError;
        if (!pendingList || pendingList.length === 0) {
            return new Response(JSON.stringify({ processed: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`처리 대상 ${pendingList.length}건`);

        // 2. eSignon 토큰 1회 발급 (여러 건 처리할 때 공유)
        const accessToken = await getEsignonToken();

        let completed = 0;
        let canceled = 0;

        for (const pending of pendingList) {
            try {
                const { isComplete, isCanceled } = await checkWorkflowStatus(pending.workflow_id, accessToken);

                if (isComplete) {
                    // order_data는 이미 암호화된 상태로 저장되어 있음 → 바로 insert
                    const { error: insertError } = await supabase
                        .from("orders")
                        .insert([pending.order_data]);

                    if (insertError) {
                        console.error(`주문 저장 실패 (${pending.workflow_id}):`, insertError);
                        continue;
                    }

                    // SMS 발송 (phone은 암호화되어 있으므로 생략 - 복호화 불가)
                    // SMS는 클라이언트 측 useEsignonPolling이 처리하거나 별도 로직 필요

                    // pending_signatures에서 삭제
                    await supabase.from("pending_signatures").delete().eq("id", pending.id);
                    completed++;
                    console.log(`완료 처리: ${pending.workflow_id}`);

                } else if (isCanceled) {
                    await supabase.from("pending_signatures").delete().eq("id", pending.id);
                    canceled++;
                    console.log(`취소 처리: ${pending.workflow_id}`);
                }
            } catch (e) {
                console.error(`workflow ${pending.workflow_id} 처리 오류:`, e);
            }
        }

        return new Response(
            JSON.stringify({ processed: pendingList.length, completed, canceled }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("process-pending-signatures 오류:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
