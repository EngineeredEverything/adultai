export interface Category {
    id: string;
    name: string;
    keywords: string[];
    imageCount: number;
    sampleImage: {
        id: string;
        imageUrl: string | null;
    } | null;
}
