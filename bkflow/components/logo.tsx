import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import localFont from 'next/font/local';

const headingFont = localFont({
    src: "../public/fonts/font.woff2"
});

export const Logo = () => {
    return (
        <Link href="/" >
            <div className="hover:opacity-80 transition items-center gap-x-2 hidden md:flex">
                <Image 
                    src="/logo.svg"
                    alt="UniFlow Logo"
                    height={45}
                    width={45}
                />
                <p className={cn("text-2xl font-bold tracking-tight", 
                    headingFont.className)}>
                    <span className="text-[#041a4e] dark:text-white">Uni</span>
                    <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">Flow</span>
                </p>
            </div>
        </Link>
    );
}