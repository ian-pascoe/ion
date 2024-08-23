import { apigatewayv2, lambda } from "@pulumi/aws";
import {
  ComponentResourceOptions,
  Input,
  interpolate,
  Output,
  output,
} from "@pulumi/pulumi";
import { Component, transform } from "../component";
import { VisibleError } from "../error";
import { ApiGatewayV2AuthorizerArgs } from "./apigatewayv2";
import { Function } from "./function";

export interface AuthorizerArgs extends ApiGatewayV2AuthorizerArgs {
  /**
   * The API Gateway to use for the route.
   */
  api: Input<{
    id: Input<string>;
    name: Input<string>;
    executionArn: Input<string>;
  }>;
}

/**
 * The `ApiGatewayV2Authorizer` component is internally used by the `ApiGatewayV2` component
 * to add authorizers to [Amazon API Gateway HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html).
 *
 * :::note
 * This component is not intended to be created directly.
 * :::
 *
 * You'll find this component returned by the `addAuthorizer` method of the `ApiGatewayV2` and `ApiGatewayWebSocket` components.
 */
export class ApiGatewayV2Authorizer extends Component {
  private readonly authorizer: apigatewayv2.Authorizer;
  private readonly function?: Output<Function>;
  private readonly permission?: lambda.Permission;

  constructor(
    name: string,
    args: AuthorizerArgs,
    opts?: ComponentResourceOptions,
  ) {
    super(__pulumiType, name, args, opts);

    const self = this;

    const api = output(args.api);

    validateSingleAuthorizer();
    const type = getType();

    const fn = createFunction();
    const authorizer = createAuthorizer();
    const permission = createPermission();

    this.function = fn;
    this.permission = permission;
    this.authorizer = authorizer;

    function validateSingleAuthorizer() {
      const authorizers = [args.lambda, args.jwt].filter((e) => e);
      if (authorizers.length === 0)
        throw new VisibleError(
          `Please provide one of "lambda" or "jwt" for the ${args.name} authorizer.`,
        );

      if (authorizers.length > 1) {
        throw new VisibleError(
          `Please provide only one of "lambda" or "jwt" for the ${args.name} authorizer.`,
        );
      }
    }

    function getType() {
      if (args.jwt) return "JWT";
      if (args.lambda) return "REQUEST";
      throw new VisibleError(
        `Please provide one of "lambda" or "jwt" for the ${args.name} authorizer.`,
      );
    }

    function createAuthorizer() {
      return new apigatewayv2.Authorizer(
        ...transform(
          args.transform?.authorizer,
          `${name}Authorizer`,
          {
            apiId: api.id,
            authorizerType: type,
            identitySources: args.jwt
              ? output(args.jwt).apply((jwt) => [
                  jwt.identitySource ?? "$request.header.Authorization",
                ])
              : undefined,
            jwtConfiguration: args.jwt
              ? output(args.jwt).apply((jwt) => ({
                  audiences: jwt.audiences,
                  issuer: jwt.issuer,
                }))
              : undefined,
            authorizerUri: fn?.nodes.function.invokeArn,
            authorizerPayloadFormatVersion: "1.0", // 1.0 is the only supported version for websockets so we'll default to that
          },
          { parent: self },
        ),
      );
    }

    function createFunction() {
      const fn = args.lambda;
      if (!fn) return;

      return Function.fromDefinition(`${name}LambdaAuthorizerFn`, fn, {
        description: interpolate`${api.name} authorizer function`,
      });
    }

    function createPermission() {
      if (!fn) return;

      return new lambda.Permission(
        `${name}Permission`,
        {
          action: "lambda:InvokeFunction",
          function: fn.arn,
          principal: "apigateway.amazonaws.com",
          sourceArn: interpolate`${api.executionArn}/authorizers/${authorizer.id}`,
        },
        { parent: self },
      );
    }
  }

  /**
   * The ID of the authorizer.
   */
  public get id() {
    return this.authorizer.id;
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    const self = this;
    return {
      /**
       * The API Gateway V2 authorizer.
       */
      authorizer: this.authorizer,

      /**
       * The Lambda function used by the authorizer.
       */
      get function() {
        if (!self.function)
          throw new VisibleError(
            "Cannot access `nodes.function` because the data source does not use a Lambda function.",
          );
        return self.function;
      },

      /**
       * The IAM authorization permission.
       */
      get permission() {
        if (!self.permission)
          throw new VisibleError(
            "Cannot access `nodes.permission` because the data source does not use a Lambda function.",
          );
        return self.permission;
      },
    };
  }
}

const __pulumiType = "sst:aws:ApiGatewayV2Authorizer";
// @ts-expect-error
ApiGatewayV2Authorizer.__pulumiType = __pulumiType;
