import { Sidebar } from "./sidebar";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";

export const SidebarShell = ({ children }: { children: React.ReactNode }) => {
    const isOpen = useBoardSidebar(state => state.isOpen);
    return (
        <div className="workspace-shell min-h-screen w-full pt-14">
            <div className="flex">
                <div hidden={!isOpen} className={isOpen ? "hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block" : "hidden"}>
                    <aside aria-label="Thanh điều hướng cá nhân" className="sticky top-14 max-h-[calc(100dvh-3.5rem)] min-h-[calc(100vh-3.5rem)] overflow-y-auto px-2 py-3">
                        <Sidebar />
                    </aside>
                </div>
                <main className="min-w-0 flex-1 px-4 py-7 pb-24 sm:px-7 lg:px-10 lg:py-9">
                    {children}
                </main>
            </div>
        </div>
    );
};
