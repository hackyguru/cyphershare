// components/files/EncryptionBadge.tsx
import { Info, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
interface Props { 
  accessCondition?: string 
}

export default function EncryptionBadge({ accessCondition }: Props) {
  if (!accessCondition) return null;
  
  return (

    <div className="flex items-center text-yellow-600 dark:text-yellow-500 mt-1 text-xs">
    <Lock className="h-3 w-3 mr-1" />
    <span>Encrypted</span>
    {accessCondition && (
      <Tooltip>
        <TooltipTrigger>
          <Info className="h-3 w-3 ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{accessCondition}</p>
        </TooltipContent>
      </Tooltip>
    )}
    </div>
    
  );
}
