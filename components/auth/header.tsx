import Image from "next/image";

interface HeaderProps {
  label: string;
  title: string;
}

export const Header = ({ label, title }: HeaderProps) => {
  return (
    <div className="w-full flex flex-col gap-y-3 items-center justify-center">
      {/* Logo mark */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-50" />
        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <span className="text-white font-black text-xl leading-none">A</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white tracking-tight">
        {title}
      </h1>

      {/* Subtitle */}
      <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
        {label}
      </p>
    </div>
  );
};
