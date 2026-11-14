/** Gợi ý nguồn trên màn chào: chỉ mời đọc Gmail khi server xác nhận đã kết nối; còn lại là thêm việc từ nội dung. */
export const homeSourceAction = (input: { configured: boolean; gmailConnected: boolean; inventoryReady: boolean }): "gmail" | "capture" =>
  input.configured && input.gmailConnected && input.inventoryReady ? "gmail" : "capture";
