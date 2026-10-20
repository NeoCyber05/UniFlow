import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSyllabusMarkdown } from "./catalog-content";

const SAMPLE = `
## **IT2110** Nhập môn công nghệ thông tin và truyền thông (*Introduction to ICT*)
- Khối lượng (*Credits*): 2(2-0-0-4)
- Học phần tiên quyết (*Prerequisite*): Không (*None*)
- Tỷ lệ đánh giá (*Evaluation ratio*): 30% Quá trình (*Progress*) + 70% Thi (*Final exam*)

**Mục tiêu:** Môn học cung cấp các khái niệm cơ bản về Công nghệ thông tin và Truyền thông.

*Objectives: This course introduces the fundamental concepts of ICT.*

**Nội dung:** Môn học bao gồm các chủ đề về các hệ thống phần cứng, phần mềm như các phép toán
trên số nhị phân, tổ chức của máy tính.

*Contents: The course covers a variety of topics.*

IT3011 Cấu trúc dữ liệu và thuật toán
- Khối lượng (Credits): 2(2-1-0-4)
`;

describe("parseSyllabusMarkdown", () => {
  const map = parseSyllabusMarkdown(SAMPLE);

  it("tách từng môn theo dòng mã + tên, bỏ markdown và tên tiếng Anh", () => {
    assert.equal(map.size, 2);
    const ict = map.get("IT2110")!;
    assert.equal(ict.name, "Nhập môn công nghệ thông tin và truyền thông");
    assert.equal(ict.credits, 2);
    assert.equal(ict.evaluation, "30% Quá trình + 70% Thi");
    assert.equal(ict.objectives, "Môn học cung cấp các khái niệm cơ bản về Công nghệ thông tin và Truyền thông.");
  });

  it("Nội dung nối nhiều dòng, dừng ở phần tiếng Anh", () => {
    assert.equal(
      map.get("IT2110")!.content,
      "Môn học bao gồm các chủ đề về các hệ thống phần cứng, phần mềm như các phép toán trên số nhị phân, tổ chức của máy tính.",
    );
  });

  it("môn thiếu Nội dung vẫn giữ, content = null", () => {
    const dsa = map.get("IT3011")!;
    assert.equal(dsa.name, "Cấu trúc dữ liệu và thuật toán");
    assert.equal(dsa.content, null);
  });
});
