"use client";

import { Check, X, HelpCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const features = [
  {
    name: "Monthly TEMPT",
    free: "200",
    basic: "500",
    pro: "1,500",
    unlimited: "Unlimited",
    tooltip: "Nuts are used to generate images. Each image costs 10 TEMPT.",
  },
  {
    name: "Images Per Generation",
    free: "1",
    basic: "4",
    pro: "4",
    unlimited: "10",
    tooltip: "Number of variations you can generate at once.",
  },
  {
    name: "Image Resolution",
    free: "Basic (512×512)",
    basic: "HD (1024×1024)",
    pro: "4K (2048×2048)",
    unlimited: "8K (4096×4096)",
    tooltip: "Maximum resolution of generated images.",
  },
  {
    name: "Negative Prompts",
    free: false,
    basic: "Basic",
    pro: "Advanced",
    unlimited: "Advanced",
    tooltip: "Specify what you don't want in your generated images.",
  },
  {
    name: "Style Customization",
    free: false,
    basic: "Limited",
    pro: "Full",
    unlimited: "Full",
    tooltip: "Control the artistic style of your generated images.",
  },
  {
    name: "Response Time",
    free: "Standard",
    basic: "Faster",
    pro: "Priority",
    unlimited: "Instant",
    tooltip: "How quickly your image generation requests are processed.",
  },
  {
    name: "Priority Support",
    free: false,
    basic: false,
    pro: false,
    unlimited: true,
    tooltip: "Get faster responses from our support team.",
  },
];

export function FeatureComparison() {
  return (
    <TooltipProvider>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Feature</TableHead>
              <TableHead className="text-center">Free</TableHead>
              <TableHead className="text-center">Basic</TableHead>
              <TableHead className="text-center">Pro</TableHead>
              <TableHead className="text-center">Unlimited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature) => (
              <TableRow key={feature.name}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {feature.name}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground ml-1 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{feature.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {typeof feature.free === "boolean" ? (
                    feature.free ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    )
                  ) : (
                    feature.free
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {typeof feature.basic === "boolean" ? (
                    feature.basic ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    )
                  ) : (
                    feature.basic
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {typeof feature.pro === "boolean" ? (
                    feature.pro ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    )
                  ) : (
                    feature.pro
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {typeof feature.unlimited === "boolean" ? (
                    feature.unlimited ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    )
                  ) : (
                    feature.unlimited
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
