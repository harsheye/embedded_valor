import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: string;
  size?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild, variant, size, ...props }, ref) => {
    if (asChild && React.isValidElement(props.children)) {
      const child = props.children as React.ReactElement<any>;
      return React.cloneElement(child, {
        className: cn("btn btn-primary", className, child.props.className),
        onClick: (e: any) => {
          if (props.onClick) props.onClick(e);
          if (child.props.onClick) child.props.onClick(e);
        },
        ...props,
        children: child.props.children
      } as any);
    }
    const variantClass = variant === "ghost" ? "btn-ghost" : variant === "outline" ? "btn-outline" : "btn-primary";
    return (
      <button
        className={cn("btn", variantClass, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
