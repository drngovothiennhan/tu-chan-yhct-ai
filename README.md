# Tứ Chẩn YHCT AI

Ứng dụng độc lập cho quy trình **Vọng → Văn → Vấn → Thiệt → Tổng hợp**.

## Phạm vi V1

- Vọng: kiểm tra chất lượng khung hình camera cục bộ.
- Văn: ghi nhận đặc trưng giọng nói cục bộ từ 5 câu đọc.
- Vấn: 10 nhóm câu hỏi theo Thập vấn.
- Thiệt: nhận ảnh lưỡi qua adapter độc lập; chưa giả lập engine chẩn đoán thật.
- Tổng hợp: báo cáo hỗ trợ theo dõi, không thay thế chẩn đoán y tế.

## Build

```bash
npm install
npm run build
```

## Vercel

Repo đã có `vercel.json` với framework Vite, build `npm run build`, output `dist`.

[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdrngovothiennhan%2Ftu-chan-yhct-ai&project-name=tu-chan-yhct-ai&repository-name=tu-chan-yhct-ai)
