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

  export function authorizer(
    input: (
      event: APIGatewayRequestAuthorizerEvent,
      context: Context
    ) => Promise<AuthResult>
  ): APIGatewayRequestAuthorizerHandler {
    return async (event, ctx) => {
      const {
        authorized,
        principalId = new Date().toString(),
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
