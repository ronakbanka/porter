import React, { useState } from "react";
import styled from "styled-components";
import { Event } from "./EventsTab";
import Loading from "../../../../../components/Loading";

type CardProps = {
  event: Event;
  selectEvent?: () => void;
  overrideName?: string;
};

export const getReadableDate = (s: number) => {
  let ts = new Date(s * 1000);
  let date = ts.toLocaleDateString();
  let time = ts.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} ${date}`;
};

// Rename to Event Card
const EventCard: React.FunctionComponent<CardProps> = ({
  event,
  selectEvent,
  overrideName,
}) => {
  return (
    <StyledCard>
      <ContentContainer onClick={() => selectEvent && selectEvent()}>
        {event.status == 1 && (
          <Icon status={"normal"} className="material-icons-outlined">
            check
          </Icon>
        )}
        {event.status == 2 && (
          <Icon status={"critical"} className="material-icons-outlined">
            autorenew
          </Icon>
        )}
        {event.status == 3 && (
          <Icon status={"critical"} className="material-icons-outlined">
            error
          </Icon>
        )}
        <EventInformation>
          <EventName>{overrideName ? overrideName : event.name}</EventName>
          <EventReason>
            {event.status == 2 && (
              <Helper>Step {event.name} In Progress</Helper>
            )}
            {event.status == 1 && <Helper>Step {event.name} Successful</Helper>}
            {event.status == 3 && (
              <Helper>
                Step {event.name} failed: {event.info}
              </Helper>
            )}
          </EventReason>
        </EventInformation>
      </ContentContainer>
      <ActionContainer hasOneChild>
        <TimestampContainer>
          <TimestampIcon className="material-icons-outlined">
            access_time
          </TimestampIcon>
          <span>{getReadableDate(event.time)}</span>
        </TimestampContainer>
      </ActionContainer>
    </StyledCard>
  );
};

export default EventCard;

const StyledCard = styled.div`
  background: #26282f;
  min-height: 100px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #26282f;
  box-shadow: 0 4px 15px 0px #00000055;
  border-radius: 8px;
  padding: 14px;
  animation: fadeIn 0.5s;
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ContentContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  align-items: center;
`;

const Icon = styled.span`
  font-size: 35px;
  margin-right: 14px;
  color: ${({ status }: { status: "critical" | "normal" }) =>
    status === "critical" ? "red" : "green"};
`;

const EventInformation = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
`;

const EventName = styled.div`
  font-size: 14px;
  font-family: "Work Sans", sans-serif;
  font-weight: 500;
  color: #ffffff;
`;

const Helper = styled.span`
  font-size: 14px;
  text-transform: capitalize;
  color: #ffffff44;
  margin-right: 5px;
`;

const EventReason = styled.div`
  font-size: 18px;
  font-family: "Work Sans", sans-serif;
  color: #ffffff;
  margin-top: 8px;
`;

const ActionContainer = styled.div`
  width: max-content;
  display: flex;
  align-items: center;
  white-space: nowrap;
  height: 100%;
  flex-direction: column;
  justify-content: ${(props: { hasOneChild: boolean }) => {
    return props.hasOneChild ? "flex-end" : "space-between";
  }};
`;

const HistoryButton = styled.button`
  position: relative;
  border: none;
  background: none;
  color: white;
  padding: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  color: #ffffff44;
  :hover {
    background: #32343a;
    cursor: pointer;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  left: 0px;
  word-wrap: break-word;
  top: 38px;
  min-height: 18px;
  padding: 5px 7px;
  background: #272731;
  z-index: 999;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  color: white;
  text-transform: none;
  font-size: 12px;
  font-family: "Work Sans", sans-serif;
  outline: 1px solid #ffffff55;
  opacity: 0;
  animation: faded-in 0.2s 0.15s;
  animation-fill-mode: forwards;
  @keyframes faded-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const TimestampContainer = styled.div`
  display: flex;
  white-space: nowrap;
  align-items: center;
  justify-self: flex-end;
`;

const TimestampIcon = styled.span`
  margin-right: 5px;
`;
