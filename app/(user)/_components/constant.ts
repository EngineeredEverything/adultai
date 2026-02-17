import {
    Box,
    ChevronLeft,
    GalleryThumbnailsIcon,
    HeartIcon,
    ImagePlus,
    Library,
    LogOut,
    UserCog,
    UserIcon,
    VideoIcon,
} from "lucide-react";

export const navItems = [
    {
        title: "Companions",
        icon: HeartIcon,
        href: "/companions",
    },
    {
        title: "Gallery",
        icon: GalleryThumbnailsIcon,
        href: "/gallery",
    },
    {
        title: "Video Gallery",
        icon: VideoIcon,
        href: "/video-gallery",
    },
    {
        title: "Advanced Generate",
        icon: ImagePlus,
        href: "/advanced-generate",
    },
    {
        title: "Categories",
        icon: Library,
        href: "/categories",
    },
];

export const userNavItems = [
    {
        title: "Profile",
        icon: UserIcon,
        href: "/profile",
    },
    {
        title: "User Images",
        icon: GalleryThumbnailsIcon,
        href: "/gallery/user",
    },
    {
        title: "Subscription",
        icon: Box,
        href: "/subscription",
    },
]
