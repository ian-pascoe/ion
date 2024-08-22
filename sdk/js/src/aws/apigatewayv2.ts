import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerHandler,
  Context,
} from "aws-lambda";

export module apigatewayv2 {
  export interface AuthResult extends Partial<APIGatewayAuthorizerResult> {
    /**
     * Whether the request was successfully authorized.
     */
    authorized: boolean;
  }

  /**
   * Create an authorization handler for the `ApiGatewayV2` component. This can also be used for `ApiGatewayWebSocket`.
   *
   * @example
   * ```js
   * import { apigatewayv2 } from "sst/aws/apigatewayv2";
   *
   * const authorizer = apigatewayv2.authorizer(async (event, context) => {
   *   // Validate the request using event.requestContext.headers, event.multiValueHeaders, etc.
   *
   *   return {
   *     authorized: true,
   *     context: {
   *       userId: "123456789012", // This can be accessed in the API route handler via event.requestContext.authorizer.userId
   *     }
   *   };
   * });
   * ```
   */
  export function authorizer(
    input: (
      event: APIGatewayRequestAuthorizerEvent,
      context: Context
    ) => Promise<AuthResult>
  ): APIGatewayRequestAuthorizerHandler {
    return async (event, ctx) => {
      const {
        authorized,
        principalId = Date.now().toString(),
        context,
        usageIdentifierKey,
        policyDocument,
      } = await input(event, ctx);

      if (!authorized) {
        return {
          principalId,
          policyDocument: {
            Version: "2012-10-17",
            ...policyDocument,
            Statement: [
              {
                Action: "execute-api:Invoke",
                Effect: "Deny",
                Resource: event.methodArn,
              },
              ...(policyDocument?.Statement ?? []),
            ],
          },
          context,
          usageIdentifierKey,
        };
      }

      return {
        principalId: principalId ?? new Date().toString(),
        policyDocument: {
          Version: "2012-10-17",
          ...policyDocument,
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Allow",
              Resource: event.methodArn,
            },
            ...(policyDocument?.Statement ?? []),
          ],
        },
        context,
        usageIdentifierKey,
      };
    };
  }
}
