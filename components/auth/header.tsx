import Image from "next/image";

interface HeaderProps {
  label: string;
  title: string;
}

export const Header = ({ label, title }: HeaderProps) => {
  return (
    <div className="w-full flex flex-col gap-y-4 items-center justify-center">
      <div className="flex items-center gap-2">
        <Image src={"/logo.png"} alt="adultai logo" width={50} height={50} />
        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          {title}
        </h1>
      </div>
      <p className="text-muted-foreground text-sm text-center max-w-sm leading-relaxed">
        {label}
      </p>
    </div>
  );
};
