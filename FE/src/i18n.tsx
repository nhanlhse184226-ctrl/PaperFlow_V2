import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Language = "en" | "vi";

const vietnamese: Record<string, string> = {
  "Understand what each paper brings to your research.": "Hiểu giá trị mỗi tài liệu mang lại cho nghiên cứu của bạn.",
  "Upload research PDFs": "Tải tài liệu nghiên cứu PDF",
  "You can upload now.": "Bạn có thể tải tài liệu lên ngay.",
  "Confirm your direction": "Xác nhận hướng nghiên cứu",
  "before source evaluation.": "trước khi đánh giá tài liệu.",
  "Bring your reading into one place": "Tập hợp tài liệu đọc tại một nơi",
  "Drop PDFs here or": "Thả PDF vào đây hoặc",
  "browse files": "chọn tệp",
  ". Up to 20 MB and 150 pages per source.": ". Tối đa 20 MB và 150 trang mỗi tài liệu.",
  "A stronger argument starts with good sources": "Lập luận vững chắc bắt đầu từ nguồn tài liệu tốt",
  "Upload research papers to assess relevance, methods, findings, and limitations.": "Tải bài nghiên cứu để đánh giá mức độ liên quan, phương pháp, phát hiện và giới hạn.",
  "The evidence, side by side": "Đặt các bằng chứng cạnh nhau",
  "Compare what your sources say. Keep every finding connected to its context.": "So sánh nội dung các nguồn. Gắn từng phát hiện với bối cảnh của nó.",
  "Export CSV": "Xuất CSV",
  "Compare sources": "So sánh nguồn",
  "Search evidence": "Tìm bằng chứng",
  "Search evidence…": "Tìm bằng chứng…",
  "Evidence type": "Loại bằng chứng",
  "All evidence types": "Tất cả loại bằng chứng",
  "Make the connections visible": "Làm rõ các mối liên hệ",
  "Process your sources to build a matrix of findings, methods, limitations, and gaps.": "Xử lý tài liệu để tạo ma trận phát hiện, phương pháp, giới hạn và khoảng trống nghiên cứu.",
  "Go to sources": "Đến nguồn tài liệu",
  "Trace the claims in your draft back to your project’s sources.": "Đối chiếu luận điểm trong bài nháp với các nguồn của dự án.",
  "Upload academic draft": "Tải bản thảo học thuật",
  "This checks evidence alignment, not writing quality. Assessments use your uploaded sources and need your judgment.": "Kiểm tra mức độ phù hợp của bằng chứng với bài viết. Đánh giá dựa trên tài liệu đã tải lên và cần bạn xem xét.",
  "Bring your writing into the workspace": "Đưa bài viết vào không gian nghiên cứu",
  "Paste an essay, literature review, report, or thesis section. Editing resets this draft’s evidence check.": "Dán bài luận, tổng quan tài liệu, báo cáo hoặc một phần luận văn. Chỉnh sửa sẽ đặt lại kết quả kiểm tra của bài nháp này.",
  "Draft title": "Tiêu đề bài nháp",
  "Academic draft": "Bản thảo học thuật",
  "e.g. Literature review · first draft": "Ví dụ: Tổng quan tài liệu · bản nháp đầu tiên",
  "Paste your writing here, including any in-text citations…": "Dán bài viết tại đây, gồm cả các trích dẫn trong bài…",
  "Describe the idea, who it affects, and why it interests you.": "Mô tả ý tưởng, đối tượng liên quan và lý do bạn quan tâm.",
  "e.g. 12 weeks": "Ví dụ: 12 tuần",
  "Opening your workspace…": "Đang mở không gian làm việc…",
  "Retry connection": "Thử kết nối lại",
  "Something went wrong. Please retry.": "Đã xảy ra lỗi. Vui lòng thử lại.",
  "PERSONAL WORKSPACE": "KHÔNG GIAN LÀM VIỆC CÁ NHÂN",
  Overview: "Tổng quan",
  "Research projects": "Dự án nghiên cứu",
  "Topic experience hub": "Cộng đồng trao đổi chủ đề",
  "Good research starts": "Nghiên cứu tốt bắt đầu",
  "with a good question.": "từ một câu hỏi hay.",
  "One connected path from an early idea to evidence you can trace.": "Một hành trình liền mạch từ ý tưởng ban đầu đến bằng chứng có thể truy vết.",
  "My workspace": "Không gian của tôi",
  "Sign out": "Đăng xuất",
  "Research Readiness Workspace": "Không gian chuẩn bị nghiên cứu",
  "Thoughtful research. Traceable evidence.": "Nghiên cứu có chiều sâu. Bằng chứng có thể truy vết.",
  "Make every claim count.": "Mỗi luận điểm đều có giá trị.",
  "RESEARCH, WITH DIRECTION": "NGHIÊN CỨU CÓ ĐỊNH HƯỚNG",
  "A clearer path": "Một lộ trình rõ ràng hơn",
  from: "từ",
  idea: "ý tưởng",
  "to evidence.": "đến bằng chứng.",
  "From vague research topics to citation-backed evidence.": "Từ đề tài mơ hồ đến bằng chứng có trích dẫn.",
  Topic: "Chủ đề",
  Sources: "Nguồn tài liệu",
  Evidence: "Bằng chứng",
  Claims: "Luận điểm",
  "A research readiness workspace. Built for thoughtful work.": "Không gian chuẩn bị nghiên cứu, dành cho công việc có chiều sâu.",
  "YOUR NEXT CHAPTER STARTS HERE": "BƯỚC TIẾP THEO BẮT ĐẦU TỪ ĐÂY",
  "Create your workspace": "Tạo không gian làm việc",
  "Welcome back.": "Chào mừng bạn trở lại.",
  "Give your research a place to take shape.": "Tạo nơi để nghiên cứu của bạn dần thành hình.",
  "Pick up where your research left off.": "Tiếp tục công việc nghiên cứu của bạn.",
  "Email address": "Địa chỉ email",
  Password: "Mật khẩu",
  "At least 12 characters": "Ít nhất 12 ký tự",
  "Create account": "Tạo tài khoản",
  "Sign in": "Đăng nhập",
  "Already have an account?": "Bạn đã có tài khoản?",
  "New to PaperFlow?": "Bạn mới dùng PaperFlow?",
  "Your projects and uploaded sources stay private. Hub notes are shared only when you publish them.": "Dự án và tài liệu bạn tải lên luôn riêng tư. Ghi chú cộng đồng chỉ được chia sẻ khi bạn xuất bản.",
  "YOUR RESEARCH, CONNECTED": "NGHIÊN CỨU ĐƯỢC KẾT NỐI",
  "A little clarity. A lot of possibility.": "Thêm rõ ràng. Thêm nhiều khả năng.",
  "A home for every question worth exploring.": "Nơi dành cho mọi câu hỏi đáng để khám phá.",
  "Turn your next big question into a well-grounded research direction.": "Biến câu hỏi lớn tiếp theo thành một hướng nghiên cứu vững chắc.",
  "New project": "Dự án mới",
  "FROM IDEA TO EVIDENCE": "TỪ Ý TƯỞNG ĐẾN BẰNG CHỨNG",
  "Great research doesn’t": "Nghiên cứu tốt không",
  "start with all the answers.": "bắt đầu với mọi câu trả lời.",
  "Start with a question. Find your direction, understand your sources, and build claims you can stand behind.": "Bắt đầu bằng một câu hỏi. Tìm hướng đi, hiểu tài liệu và xây dựng những luận điểm có cơ sở.",
  "Start your research": "Bắt đầu nghiên cứu",
  "Evidence connected": "Bằng chứng đã kết nối",
  "Every claim.": "Mỗi luận điểm.",
  "A traceable source.": "Một nguồn có thể truy vết.",
  "One workspace. Four connected steps.": "Một không gian. Bốn bước kết nối.",
  "THE RESEARCH PATH": "HÀNH TRÌNH NGHIÊN CỨU",
  "Find your direction": "Tìm hướng đi",
  "Shape a focused, feasible research topic.": "Định hình đề tài tập trung và khả thi.",
  "Know your sources": "Hiểu nguồn tài liệu",
  "Understand relevance, methods, and limits.": "Hiểu mức độ liên quan, phương pháp và giới hạn.",
  "Connect the evidence": "Kết nối bằng chứng",
  "Compare findings. Keep the context.": "So sánh phát hiện. Giữ nguyên bối cảnh.",
  "Check your claims": "Kiểm tra luận điểm",
  "See what your sources actually support.": "Xem nguồn tài liệu thực sự hỗ trợ điều gì.",
  "All projects": "Tất cả dự án",
  "Your research projects": "Các dự án nghiên cứu của bạn",
  "Search projects": "Tìm dự án",
  "Find a project…": "Tìm một dự án…",
  Retry: "Thử lại",
  "Loading your projects…": "Đang tải dự án…",
  "Direction confirmed": "Đã xác nhận hướng đi",
  "Exploring a topic": "Đang khám phá chủ đề",
  sources: "nguồn tài liệu",
  "evidence items": "mục bằng chứng",
  Updated: "Cập nhật",
  "No matching projects": "Không có dự án phù hợp",
  "Your next research idea belongs here": "Ý tưởng nghiên cứu tiếp theo của bạn thuộc về nơi này",
  "Try a different title or topic.": "Hãy thử tiêu đề hoặc chủ đề khác.",
  "Create a project to bring your topic, sources, evidence, and writing together.": "Tạo dự án để tập hợp chủ đề, tài liệu, bằng chứng và bài viết.",
  "Create your first project": "Tạo dự án đầu tiên",
  "A new beginning": "Một khởi đầu mới",
  "Give your research project a name. You can refine the topic inside your workspace.": "Đặt tên cho dự án nghiên cứu. Bạn có thể tinh chỉnh chủ đề trong không gian làm việc.",
  "Project name": "Tên dự án",
  "Create project": "Tạo dự án",
  "RESEARCH WORKSPACE": "KHÔNG GIAN NGHIÊN CỨU",
  "Direction in progress": "Đang hoàn thiện hướng đi",
  "Topic direction": "Định hướng chủ đề",
  "Evidence matrix": "Ma trận bằng chứng",
  "Essay check": "Kiểm tra bài viết",
  Dismiss: "Đóng",
  "Results are saved as processing completes.": "Kết quả sẽ được lưu khi xử lý hoàn tất.",
  "Opening project…": "Đang mở dự án…",
  "Follow the evidence": "Theo dõi bằng chứng",
  "Verified quotation": "Trích dẫn đã xác minh",
  "The quotation is checked against extracted page text. The structured interpretation still needs your review.": "Trích dẫn được đối chiếu với văn bản trang đã trích xuất. Phần diễn giải vẫn cần bạn xem xét.",
  "Open original PDF · page": "Mở PDF gốc · trang",
  "Read extracted page context": "Đọc ngữ cảnh trang đã trích xuất",
  "Shape your research question": "Định hình câu hỏi nghiên cứu",
  "Start with what you know. Uncertainty is a useful part of the process.": "Bắt đầu từ điều bạn biết. Sự chưa chắc chắn là một phần hữu ích của quá trình.",
  "Topic or working title": "Chủ đề hoặc tiêu đề dự kiến",
  "What do you want to explore?": "Bạn muốn khám phá điều gì?",
  "Team size": "Số thành viên",
  Timeline: "Thời gian thực hiện",
  "Add more research context": "Thêm bối cảnh nghiên cứu",
  "Optional, but helpful": "Tùy chọn, nhưng hữu ích",
  "Problem statement": "Vấn đề nghiên cứu",
  Objectives: "Mục tiêu",
  "Research questions": "Câu hỏi nghiên cứu",
  "Team skills": "Kỹ năng nhóm",
  "Available sources / source readiness": "Nguồn sẵn có / mức sẵn sàng tài liệu",
  "Datasets / data readiness": "Dữ liệu / mức sẵn sàng dữ liệu",
  "Technical and project constraints": "Ràng buộc kỹ thuật và dự án",
  "Save context": "Lưu bối cảnh",
  "Check direction": "Kiểm tra hướng đi",
  "Reanalyze topic": "Phân tích lại chủ đề",
  "DIRECTION CHECK · AI ANALYSIS": "KIỂM TRA HƯỚNG ĐI · PHÂN TÍCH AI",
  "A clearer view of your idea": "Góc nhìn rõ hơn về ý tưởng của bạn",
  "Risks to plan for": "Rủi ro cần lên kế hoạch",
  "What’s still unknown": "Điều còn chưa rõ",
  "Suggested next steps": "Bước tiếp theo đề xuất",
  "Possible refinements": "Các hướng tinh chỉnh",
  "Choose a suggestion to edit your working title, then analyze the updated topic.": "Chọn một gợi ý để sửa tiêu đề dự kiến, sau đó phân tích chủ đề đã cập nhật.",
  "Research direction confirmed": "Đã xác nhận hướng nghiên cứu",
  "Confirm this direction": "Xác nhận hướng đi này",
  "A direction, not a verdict": "Một định hướng, không phải phán quyết",
  "Your topic check will explore clarity, scope, feasibility, researchability, source readiness, and data readiness.": "Kiểm tra chủ đề sẽ xem xét độ rõ ràng, phạm vi, tính khả thi, khả năng nghiên cứu, mức sẵn sàng tài liệu và dữ liệu.",
  "Suggestions are based on the context you provide, not a live literature search.": "Gợi ý dựa trên bối cảnh bạn cung cấp, không phải tìm kiếm tài liệu trực tiếp.",
  "Your source library": "Thư viện tài liệu của bạn",
  "Upload PDFs": "Tải PDF lên",
  "Does your evidence support your writing?": "Bằng chứng có hỗ trợ bài viết của bạn không?",
  "Upload draft": "Tải bài nháp lên",
  "New draft": "Bài nháp mới",
  "Save draft": "Lưu bài nháp",
  "Edit draft": "Sửa bài nháp",
  "Check evidence": "Kiểm tra bằng chứng",
  "Run a new check": "Chạy kiểm tra mới",
  "Topic relevance": "Mức độ liên quan đến chủ đề",
  "Citation coverage": "Mức độ bao phủ trích dẫn",
  "Evidence limitations": "Giới hạn của bằng chứng",
  "Recommended action": "Hành động đề xuất",
  "Evidence connections": "Các liên kết bằng chứng",
  "Share a note": "Chia sẻ ghi chú",
  "Find a topic or research area…": "Tìm chủ đề hoặc lĩnh vực nghiên cứu…",
  "Search topic notes": "Tìm ghi chú chủ đề",
  "Finding topic notes…": "Đang tìm ghi chú chủ đề…",
  "Publish note": "Đăng ghi chú",
  "Close dialog": "Đóng hộp thoại",
  ready: "sẵn sàng",
  "needs attention": "cần chú ý",
  unknown: "chưa rõ",
  clarity: "độ rõ ràng",
  scope: "phạm vi",
  feasibility: "tính khả thi",
  researchability: "khả năng nghiên cứu",
  "source readiness": "mức sẵn sàng tài liệu",
  "data readiness": "mức sẵn sàng dữ liệu",
  supported: "được hỗ trợ",
  "partially supported": "được hỗ trợ một phần",
  contradicted: "mâu thuẫn",
  unsupported: "không được hỗ trợ",
  "insufficient evidence": "chưa đủ bằng chứng",
};

const english = Object.fromEntries(
  Object.entries(vietnamese).map(([source, translated]) => [translated, source]),
);

function translateRenderedUi(language: Language) {
  const terms = language === "vi" ? vietnamese : english;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, textarea, [contenteditable='true'], [data-no-ui-translation]")) return;
    const trimmed = node.data.trim();
    if (terms[trimmed] && terms[trimmed] !== trimmed) node.data = node.data.replace(trimmed, terms[trimmed]);
  });
  document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((name) => {
      const value = element.getAttribute(name);
      if (value && terms[value]) element.setAttribute(name, terms[value]);
    });
  });
}

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | null>(null);

export function useLanguage() {
  return useContext(LanguageContext)?.language ?? "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("paperflow-language") === "vi" ? "vi" : "en",
  );
  useEffect(() => {
    localStorage.setItem("paperflow-language", language);
    document.documentElement.lang = language;
    translateRenderedUi(language);
    const observer = new MutationObserver(() => translateRenderedUi(language));
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageToggle() {
  const context = useContext(LanguageContext);
  if (!context) return null;
  return (
    <div className="language-toggle" aria-label="Language selector">
      <button className={context.language === "en" ? "active" : ""} onClick={() => context.setLanguage("en")} aria-pressed={context.language === "en"}>EN</button>
      <button className={context.language === "vi" ? "active" : ""} onClick={() => context.setLanguage("vi")} aria-pressed={context.language === "vi"}>VI</button>
    </div>
  );
}
