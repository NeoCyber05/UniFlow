"use client";

import { useRouter } from "@/web/shims/next-navigation";
import type { Semester } from "@prisma/client";

import { SemesterSwitcher } from "@/components/semesters/semester-switcher";

type BoardSemesterSwitcherProps = {
  semesters: Semester[];
  currentSemesterId: string;
};

export const BoardSemesterSwitcher = ({
  semesters,
  currentSemesterId,
}: BoardSemesterSwitcherProps) => {
  const router = useRouter();

  return (
    <SemesterSwitcher
      semesters={semesters}
      selectedSemesterId={currentSemesterId}
      showAll={false}
      onSelectSemester={(semesterId) => {
        if (semesterId !== currentSemesterId) {
          router.push(`/semester/${semesterId}`);
        }
      }}
    />
  );
};
