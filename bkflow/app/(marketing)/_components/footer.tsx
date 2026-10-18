import { Logo } from "@/components/logo";

export const Footer = () => {
    return (
        <div className="fixed bottom-0 w-full p-4 border-t border-neutral-200 bg-white">
            <div className="md:max-w-screen-xl mx-auto flex items-center w-full justify-between">
                <Logo />
                <p className="text-xs text-neutral-500">
                    © {new Date().getFullYear()} HustFlow
                </p>
            </div>
        </div>
    );
};
