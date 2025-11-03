// Định nghĩa kiểu dữ liệu cho thư viện (trùng với storageService để nhất quán)
interface ChapterData {
    [chapter: string]: string;
}
interface StoryData {
    chapters: ChapterData;
    lastModified: number;
    tags?: string[];
    bookmark?: {
        chapter: string;
        scrollPosition: number;
    };
}
interface Library {
    [storyName: string]: StoryData;
}

const repeatedContent = `
Chương này kể về hành trình của một tu sĩ trẻ tên là Lý Phong. Hắn sinh ra trong một ngôi làng nhỏ, từ bé đã thể hiện tư chất hơn người. Vào một ngày định mệnh, một vị trưởng lão của Tiên Vân Tông đi ngang qua, nhận thấy được linh căn hiếm có của hắn và quyết định nhận hắn làm đệ tử.

Từ đó, Lý Phong bước vào con đường tu tiên đầy gian truân và thử thách. Hắn phải đối mặt với những cuộc tranh đoạt tài nguyên, những âm mưu hiểm độc từ các đồng môn, và cả những con yêu thú hung hãn trong các bí cảnh.

Nhờ vào sự thông minh, kiên trì và một chút may mắn, Lý Phong đã từng bước vượt qua mọi khó khăn. Hắn không chỉ nâng cao tu vi của mình mà còn kết giao được với những người bạn đồng hành đáng tin cậy.

Cuối chương, Lý Phong chuẩn bị tham gia vào đại hội tỷ thí của tông môn, một sự kiện quan trọng quyết định đến vị thế và tương lai của hắn. Ai cũng hồi hộp chờ đợi xem hắn sẽ thể hiện ra sao.
`;

const longTextPlaceholder = `
(Đây là nội dung demo được lặp lại nhiều lần để kiểm tra chức năng cuộn trang.)
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
${repeatedContent}
\n\n --- \n\n
(Kết thúc nội dung demo)
`;

export const DEMO_LIBRARY: Library = {
    "Phàm Nhân Tu Tiên (Demo)": {
        chapters: {
            "1": "Nội dung chương 1." + longTextPlaceholder,
            "2": "Nội dung chương 2." + longTextPlaceholder,
            "3.5": "Nội dung chương 3.5 (ngoại truyện)." + longTextPlaceholder,
        },
        lastModified: Date.now() - 100000,
        tags: ["Tiên Hiệp", "Cổ điển", "Demo"],
        bookmark: {
            chapter: "2",
            scrollPosition: 0.35,
        }
    },
    "Lạn Kha Kỳ Duyên (Demo)": {
        chapters: {
            "101": "Nội dung chương 101." + longTextPlaceholder.replace(/Lý Phong/g, 'Kế Duyên'),
            "102": "Nội dung chương 102." + longTextPlaceholder.replace(/Lý Phong/g, 'Kế Duyên'),
        },
        lastModified: Date.now(),
        tags: ["Huyền Huyễn", "Nhẹ nhàng", "Demo"]
    },
    "Đấu Phá Thương Khung (Demo)": {
        chapters: {
            "45": "Nội dung chương 45." + longTextPlaceholder.replace(/Lý Phong/g, 'Tiêu Viêm'),
        },
        lastModified: Date.now() - 500000,
        tags: ["Dị Giới", "Hành Động", "Demo"]
    }
};
