export const BOARD_SPACES = [
  { id: 0, name: "Bắt đầu", type: "start" },
  { id: 1, name: "Hà Giang", type: "property", color: "bg-amber-700", price: 60, rent: 2, housePrice: 50 },
  { id: 2, name: "Khí vận", type: "chest" },
  { id: 3, name: "Cao Bằng", type: "property", color: "bg-amber-700", price: 60, rent: 4, housePrice: 50 },
  { id: 4, name: "Thuế NT", type: "tax", price: 200 },
  { id: 5, name: "Bến xe M.Bắc", type: "station", price: 200, rent: 25 },
  { id: 6, name: "Hà Nội", type: "property", color: "bg-sky-400", price: 100, rent: 6, housePrice: 50 },
  { id: 7, name: "Cơ hội", type: "chance" },
  { id: 8, name: "Hải Phòng", type: "property", color: "bg-sky-400", price: 100, rent: 6, housePrice: 50 },
  { id: 9, name: "Quảng Ninh", type: "property", color: "bg-sky-400", price: 120, rent: 8, housePrice: 50 },
  { id: 10, name: "Thăm/Vào tù", type: "jail" },
  { id: 11, name: "Thanh Hóa", type: "property", color: "bg-pink-400", price: 140, rent: 10, housePrice: 100 },
  { id: 12, name: "Điện lực", type: "utility", price: 150, rent: 10 },
  { id: 13, name: "Nghệ An", type: "property", color: "bg-pink-400", price: 140, rent: 10, housePrice: 100 },
  { id: 14, name: "Hà Tĩnh", type: "property", color: "bg-pink-400", price: 160, rent: 12, housePrice: 100 },
  { id: 15, name: "Bến xe M.Trung", type: "station", price: 200, rent: 25 },
  { id: 16, name: "Huế", type: "property", color: "bg-orange-500", price: 180, rent: 14, housePrice: 100 },
  { id: 17, name: "Khí vận", type: "chest" },
  { id: 18, name: "Đà Nẵng", type: "property", color: "bg-orange-500", price: 180, rent: 14, housePrice: 100 },
  { id: 19, name: "Hội An", type: "property", color: "bg-orange-500", price: 200, rent: 16, housePrice: 100 },
  { id: 20, name: "Đỗ xe", type: "parking" },
  { id: 21, name: "Nha Trang", type: "property", color: "bg-red-500", price: 220, rent: 18, housePrice: 150 },
  { id: 22, name: "Cơ hội", type: "chance" },
  { id: 23, name: "Đà Lạt", type: "property", color: "bg-red-500", price: 220, rent: 18, housePrice: 150 },
  { id: 24, name: "Bình Thuận", type: "property", color: "bg-red-500", price: 240, rent: 20, housePrice: 150 },
  { id: 25, name: "Bến xe TN", type: "station", price: 200, rent: 25 },
  { id: 26, name: "Vũng Tàu", type: "property", color: "bg-yellow-400", price: 260, rent: 22, housePrice: 150 },
  { id: 27, name: "Bình Dương", type: "property", color: "bg-yellow-400", price: 260, rent: 22, housePrice: 150 },
  { id: 28, name: "Cấp nước", type: "utility", price: 150, rent: 10 },
  { id: 29, name: "Đồng Nai", type: "property", color: "bg-yellow-400", price: 280, rent: 24, housePrice: 150 },
  { id: 30, name: "Tới Tù", type: "go_to_jail" },
  { id: 31, name: "TP.HCM", type: "property", color: "bg-green-500", price: 300, rent: 26, housePrice: 200 },
  { id: 32, name: "Long An", type: "property", color: "bg-green-500", price: 300, rent: 26, housePrice: 200 },
  { id: 33, name: "Khí vận", type: "chest" },
  { id: 34, name: "Tiền Giang", type: "property", color: "bg-green-500", price: 320, rent: 28, housePrice: 200 },
  { id: 35, name: "Bến xe M.Nam", type: "station", price: 200, rent: 25 },
  { id: 36, name: "Cơ hội", type: "chance" },
  { id: 37, name: "Cần Thơ", type: "property", color: "bg-blue-600", price: 350, rent: 35, housePrice: 200 },
  { id: 38, name: "Thuế TS", type: "tax", price: 100 },
  { id: 39, name: "Phú Quốc", type: "property", color: "bg-blue-600", price: 400, rent: 50, housePrice: 200 }
];

export const getGridClasses = (id) => {
  if (id >= 0 && id <= 10) return { col: 11 - id, row: 11 }; // Bottom row
  if (id >= 11 && id <= 20) return { col: 1, row: 11 - (id - 10) }; // Left col
  if (id >= 21 && id <= 30) return { col: 1 + (id - 20), row: 1 }; // Top row
  if (id >= 31 && id <= 39) return { col: 11, row: 1 + (id - 30) }; // Right col
  return { col: 1, row: 1 };
};
