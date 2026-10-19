/**
 * Danh mục học phần HUST dùng để nhận diện môn khi thêm việc.
 * Môn chỉ thành `Course` trong bảng học kỳ khi người dùng gắn lần đầu (xem resolveCourseRef).
 * Mã có `x` (PE2x01) là ký tự đại diện cho một chữ số.
 */
export type CatalogCourse = { code: string; name: string };

export const HUST_COURSES: CatalogCourse[] = [
  { code: "SSH1111", name: "Triết học Mác-Lênin" },
  { code: "SSH1121", name: "Kinh tế chính trị Mác-Lênin" },
  { code: "SSH1131", name: "Chủ nghĩa xã hội khoa học" },
  { code: "SSH1141", name: "Lịch sử Đảng Cộng sản Việt Nam" },
  { code: "SSH1151", name: "Tư tưởng Hồ Chí Minh" },
  { code: "EM1170", name: "Pháp luật đại cương" },
  { code: "PE1014", name: "Lý luận TDTT" },
  { code: "PE1024", name: "Bơi lội" },
  { code: "PE2x01", name: "Giáo dục thể chất C" },
  { code: "PE2x02", name: "Giáo dục thể chất D" },
  { code: "PE2x03", name: "Giáo dục thể chất E" },
  { code: "MIL1110", name: "Đường lối quân sự của Đảng" },
  { code: "MIL1120", name: "Công tác quốc phòng-an ninh" },
  { code: "MIL1130", name: "QS chung và KCT bắn súng AK" },
  { code: "FL1101", name: "Tiếng Anh TOEIC I" },
  { code: "FL1102", name: "Tiếng Anh TOEIC II" },
  { code: "JP1110", name: "Tiếng Nhật 1" },
  { code: "JP1120", name: "Tiếng Nhật 2" },
  { code: "JP1132", name: "Tiếng Nhật 3" },
  { code: "JP2111", name: "Tiếng Nhật 4" },
  { code: "JP2126", name: "Tiếng Nhật 5" },
  { code: "JP2132", name: "Tiếng Nhật 6" },
  { code: "JP2210", name: "Tiếng Nhật 7" },
  { code: "JP2220", name: "Tiếng Nhật 8" },
  { code: "JP3110", name: "Tiếng Nhật chuyên ngành 1" },
  { code: "JP3120", name: "Tiếng Nhật chuyên ngành 2" },
  { code: "MI1144", name: "Đại số tuyến tính (Algebra)" },
  { code: "MI1114", name: "Giải tích 1 (Calculus I)" },
  { code: "MI1124", name: "Giải tích 2 (Calculus II)" },
  { code: "MI1134", name: "Phương trình vi phân và Chuỗi (DE and Series)" },
  { code: "MI2021", name: "Xác suất thống kê (Probability and Statistic)" },
  { code: "PH1110", name: "Vật lý đại cương (Basic Physics)" },
  { code: "IT3420", name: "Điện tử cho CNTT (Electronics for Information Technology)" },
  { code: "IT2140", name: "Điện tử cho CNTT lab (Electronics for Information Technology lab)" },
  { code: "IT2110", name: "Nhập môn CNTT và TT (Introduction to ICT)" },
  { code: "IT2120", name: "Kiến thức máy tính (Computer Literacy)" },
  { code: "IT3020", name: "Toán rời rạc (Discrete Math)" },
  { code: "IT4110", name: "Tính toán khoa học (Scientific computing)" },
  { code: "IT4172", name: "Xử lý tín hiệu (Signal processing)" },
  { code: "IT3362", name: "Kỹ năng ITSS 1 (học bằng tiếng Nhật) (FE-ITS Practice in Japanese 1)" },
  { code: "IT3382", name: "Kỹ năng ITSS 2 (học bằng tiếng Nhật) (FE-ITS Practice in Japanese 2)" },
  { code: "IT3210", name: "Ngôn ngữ lập trình C (C Programming Language)" },
  { code: "IT3220", name: "Thực hành ngôn ngữ lập trình C (C Programming (Introduction))" },
  { code: "IT4593", name: "Nhập môn kỹ thuật truyền thông (Introduction to Communication Engineering)" },
  { code: "IT3011", name: "Cấu trúc dữ liệu và thuật toán (Data Structures and Algorithms)" },
  { code: "IT3230", name: "Lập trình C (cơ bản) (Data Structures and Algorithms Basic Lab)" },
  { code: "IT3170", name: "Thuật toán ứng dụng (Applied Algorithms)" },
  { code: "IT4082", name: "Kỹ thuật phần mềm (Software Engineering)" },
  { code: "IT3070", name: "Nguyên lý hệ điều hành (Operating Systems)" },
  { code: "IT3080", name: "Mạng máy tính (Computer Networks)" },
  { code: "IT3292", name: "Cơ sở dữ liệu (Database)" },
  { code: "IT3290", name: "Thực hành cơ sở dữ liệu (Experiment in ICT1 (Database))" },
  { code: "IT3160", name: "Nhập môn Trí tuệ nhân tạo (Introduction to Artificial Intelligence)" },
  { code: "IT3103", name: "Lập trình hướng đối tượng (Object-oriented Programming)" },
  { code: "IT3283", name: "Kiến trúc máy tính (Computer Architecture)" },
  { code: "IT3280", name: "Thực hành kiến trúc máy tính (Assembly Language and Computer Architecture Lab)" },
  { code: "IT4015", name: "Nhập môn an toàn thông tin (Introduction to Information Security)" },
  { code: "IT5021", name: "Nghiên cứu tốt nghiệp 1 (Graduation Research 1)" },
  { code: "IT5022", name: "Nghiên cứu tốt nghiệp 2 (Graduation Research 1)" },
  { code: "IT4549", name: "Phát triển phần mềm theo chuẩn kỹ năng ITSS (ITSS Software Development)" },
  { code: "IT4062", name: "Thực hành Lập trình mạng (Network Programming)" },
  { code: "IT3323", name: "Xây dựng chương trình dịch (Compiler Construction)" },
  { code: "IT2030", name: "Technical Writing and Presentation" },
  { code: "EM1010", name: "Quản trị học đại cương (Introduction to Management)" },
  { code: "EM1180", name: "Văn hóa kinh doanh và tinh thần khởi nghiệp (Business Culture and Entrepreneurship)" },
  { code: "ED3280", name: "Tâm lý học ứng dụng (Applied Psychology)" },
  { code: "ED3220", name: "Kỹ năng mềm (Soft Skills)" },
  { code: "ET3262", name: "Tư duy công nghệ và thiết kế kỹ thuật (Technology and Technical Design Thinking)" },
  { code: "TEX3123", name: "Thiết kế mỹ thuật công nghiệp (Industrial Design)" },
  { code: "IT4409", name: "Công nghệ Web và dịch vụ trực tuyến (Web technologies and e-Services)" },
  { code: "IT4785", name: "Phát triển ứng dụng cho thiết bị di động (Mobile Programming)" },
  { code: "IT4542", name: "Quản trị phát triển phần mềm (Management of Software Development)" },
  { code: "IT4930", name: "Nhập môn Khoa học dữ liệu (Introduction to Data Science)" },
  { code: "IT3190", name: "Học máy và khai phá dữ liệu (Machine Learning and Data Mining)" },
  { code: "IT4441", name: "User Interface and User Experience (Giao diện và trải nghiệm người dùng)" },
  { code: "IT4210", name: "Hệ nhúng (Embedded Systems)" },
  { code: "IT4735", name: "IoT và ứng dụng" },
  { code: "IT4651", name: "Thiết kế và triển khai mạng IP" },
  { code: "IT4948", name: "Thực tập công nghiệp (ITSS Internship)" },
  { code: "IT4125", name: "Đồ án tốt nghiệp (Graduation Thesis)" },
];

/** id ảo phía client: chưa có Course thật, server tạo khi lưu. */
const CATALOG_PREFIX = "catalog:";
const CUSTOM_PREFIX = "custom:";

export const catalogCourseId = (code: string) => `${CATALOG_PREFIX}${code}`;
export const customCourseId = (name: string) => `${CUSTOM_PREFIX}${name.replace(/\s+/g, " ").trim().slice(0, 80)}`;

export type CourseRef = { code: string | null; name: string };

/** Trả về môn cần tạo nếu id là id ảo; id thật → null. */
export const parseCourseRef = (id: string | null | undefined): CourseRef | null => {
  if (!id) return null;
  if (id.startsWith(CATALOG_PREFIX)) {
    const code = id.slice(CATALOG_PREFIX.length);
    const course = HUST_COURSES.find((item) => item.code === code);
    return course ? { code: course.code, name: course.name } : null;
  }
  if (id.startsWith(CUSTOM_PREFIX)) {
    const name = id.slice(CUSTOM_PREFIX.length).trim();
    return name ? { code: null, name } : null;
  }
  return null;
};

export const isCourseRef = (id: string | null | undefined) => parseCourseRef(id) !== null;

/** Môn của bảng + danh mục (bỏ mã đã có trong bảng). Môn của bảng đứng trước. */
export const withCatalogCourses = <T extends { id: string; name: string; code: string | null }>(courses: T[]) => {
  const used = new Set(courses.flatMap((course) => (course.code ? [course.code.toUpperCase()] : [])));
  return [
    ...courses,
    ...HUST_COURSES
      .filter((course) => !used.has(course.code.toUpperCase()))
      .map((course) => ({ id: catalogCourseId(course.code), name: course.name, code: course.code })),
  ];
};
