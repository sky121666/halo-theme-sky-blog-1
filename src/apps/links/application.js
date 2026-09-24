// PluginLinks 2.3 public application API. Guest requests deliberately omit cookies.
export const LINK_APPLICATION_API = "/apis/api.link.halo.run/v1alpha1/link-applications";

const problemMessages = {
  "400 invalid-link-application": "请检查网站信息和联系邮箱。",
  "400 invalid-link-application-captcha": "验证码错误或已过期，请输入新的验证码。",
  "403 link-application-disabled": "友链申请暂未开放，请通过留言联系管理员。",
  "409 duplicate-link-application": "该网站已提交申请或已在友链中，请勿重复提交。",
  "409 link-application-capacity-reached": "待审核申请已满，请稍后再试。",
  "429 request-not-permitted": "请求过于频繁，请稍后再试。",
  "503 link-application-unavailable": "申请服务暂时不可用，请稍后再试。",
};

async function applicationError(response) {
  const problem = await response.json().catch(() => ({}));
  const type = String(problem.type || "").replace(/^https:\/\/halo\.run\/probs\//, "");
  return new Error(problemMessages[`${response.status} ${type}`] || "暂时无法提交，请稍后再试。");
}

export async function requestLinkCaptcha({ signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${LINK_APPLICATION_API}/captcha`, {
    method: "POST",
    credentials: "omit",
    signal,
  });
  if (!response.ok) throw await applicationError(response);
  const captcha = await response.json();
  if (!captcha.challengeId || !/^data:image\/png;base64,/.test(captcha.image)) {
    throw new Error("验证码加载失败，请重试。");
  }
  return captcha;
}

export function buildLinkApplicationPayload(values, challengeId) {
  return {
    url: values.url,
    displayName: values.displayName,
    logo: values.logo || "",
    description: values.description || "",
    email: values.email || "",
    backlink: values.backlink || "",
    feedUrls: values.rssUrl ? [values.rssUrl] : [],
    challengeId,
    captchaCode: values.captchaCode,
  };
}

export async function submitLinkApplication(values, challengeId, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(LINK_APPLICATION_API, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildLinkApplicationPayload(values, challengeId)),
    signal,
  });
  if (response.status !== 201) throw await applicationError(response);
  return response.json();
}
