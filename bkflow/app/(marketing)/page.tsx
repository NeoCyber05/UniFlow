import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarClock, GraduationCap, Users } from "lucide-react";
import Link from "@/web/shims/next-link";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const headingFont = localFont({
    src: "../../public/fonts/font.woff2",
});

const textFont = Inter({
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500", "600"],
});

const highlights = [
    {
        icon: GraduationCap,
        title: "Mỗi môn một bảng",
        description: "Gom bài tập, tài liệu và lịch thi theo từng môn, theo từng học kỳ.",
    },
    {
        icon: CalendarClock,
        title: "Không sót deadline",
        description: "Thấy ngay việc quá hạn và việc phải nộp trong 7 ngày tới.",
    },
    {
        icon: Users,
        title: "Ghi chú và trợ lý AI",
        description: "Ghi chú theo môn, nhờ AI tóm tắt và gợi ý việc cần làm.",
    },
];

const MarketingPage = () => {
    return (
        <div className="flex w-full max-w-4xl flex-col items-center gap-y-8 px-4">
            {/* Headline */}
            <div className={cn("text-center", headingFont.className)}>
                <h1 className="text-4xl font-bold leading-tight tracking-tight text-neutral-900 md:text-6xl">
                    Học kỳ này,
                    <br />
                    <span className="text-violet-700">không trễ hạn bài nào.</span>
                </h1>
            </div>

            {/* Subheadline */}
            <p className={cn(
                "max-w-xl text-center text-base leading-relaxed text-neutral-600 md:text-lg",
                textFont.className
            )}>
                HustFlow giúp sinh viên quản lý môn học, deadline và ghi chú ở cùng một nơi.
            </p>

            {/* CTA */}
            <div className={textFont.className}>
                <Button
                    size="lg"
                    asChild
                    className="h-12 rounded-lg bg-violet-600 px-6 text-base text-white hover:bg-violet-700"
                >
                    <Link href="/sign-up" className="flex items-center gap-x-2">
                        Bắt đầu miễn phí
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {/* Highlights */}
            <ul className={cn(
                "mt-6 grid w-full gap-6 border-t border-neutral-200 pt-8 sm:grid-cols-3",
                textFont.className
            )}>
                {highlights.map(({ icon: Icon, title, description }) => (
                    <li key={title}>
                        <Icon className="h-5 w-5 text-violet-600" aria-hidden />
                        <p className="mt-3 text-sm font-semibold text-neutral-900">{title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MarketingPage;
