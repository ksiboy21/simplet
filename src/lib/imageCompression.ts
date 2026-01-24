export async function compressImage(file: File): Promise<File> {
    // 1. 이미지 파일이 맞는지 확인
    if (!file.type.startsWith('image/')) {
        return file;
    }

    // 2. 이미지가 1MB 이하라면 압축하지 않음 (선택 사항, 여기서는 무조건 최적화)
    // if (file.size <= 1024 * 1024) return file;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 3. 최대 해상도 제한 (Max Width/Height 1280px) - 화질보다 속도/용량 우선
                const MAX_SIZE = 1280;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file); // fallback
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // 4. JPEG 변환 및 품질 0.6 (60%) 설정
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file); // fail safe
                        }
                    },
                    'image/jpeg',
                    0.6
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
