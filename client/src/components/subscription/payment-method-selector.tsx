import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Globe } from 'lucide-react';

export type PaymentMethod = 'stripe' | 'paystack';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ selectedMethod, onChange }: PaymentMethodSelectorProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-3 sm:p-4 pt-4 sm:pt-6">
        <RadioGroup
          value={selectedMethod}
          onValueChange={(value) => onChange(value as PaymentMethod)}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
        >
          <div>
            <div className={`flex flex-col items-center justify-between rounded-md border-2 p-3 sm:p-4 ${
              selectedMethod === 'stripe' 
                ? 'border-primary bg-primary/10' 
                : 'border-muted bg-transparent hover:bg-muted/50'
            }`}>
              <RadioGroupItem value="stripe" id="stripe" className="sr-only" />
              <Label htmlFor="stripe" className="flex flex-col items-center justify-center gap-1 sm:gap-2 w-full cursor-pointer">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 mb-1" />
                <div className="font-semibold text-sm sm:text-base">Stripe</div>
                <div className="text-xs text-muted-foreground text-center">
                  Credit/Debit Cards, Apple Pay, Google Pay
                </div>
              </Label>
            </div>
          </div>

          <div>
            <div className={`flex flex-col items-center justify-between rounded-md border-2 p-3 sm:p-4 ${
              selectedMethod === 'paystack' 
                ? 'border-primary bg-primary/10' 
                : 'border-muted bg-transparent hover:bg-muted/50'
            }`}>
              <RadioGroupItem value="paystack" id="paystack" className="sr-only" />
              <Label htmlFor="paystack" className="flex flex-col items-center justify-center gap-1 sm:gap-2 w-full cursor-pointer">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6 mb-1" />
                <div className="font-semibold text-sm sm:text-base">Paystack</div>
                <div className="text-xs text-muted-foreground text-center">
                  Local payment methods, Bank transfers, Mobile money
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}