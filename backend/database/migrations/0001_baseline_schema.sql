--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: fuel_budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_budget_items (
    item_id integer NOT NULL,
    proposal_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    energy_type character varying(20) NOT NULL,
    requested_litres numeric(12,2) DEFAULT 0 NOT NULL,
    price_per_litre numeric(12,2) DEFAULT 0 NOT NULL,
    requested_kwh numeric(12,2) DEFAULT 0 NOT NULL,
    price_per_kwh numeric(12,2) DEFAULT 0 NOT NULL,
    is_included boolean DEFAULT true NOT NULL,
    estimated_cost numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT nonnegative_fuel_quantities CHECK (((requested_litres >= (0)::numeric) AND (price_per_litre >= (0)::numeric) AND (requested_kwh >= (0)::numeric) AND (price_per_kwh >= (0)::numeric) AND (estimated_cost >= (0)::numeric))),
    CONSTRAINT valid_fuel_energy_type CHECK (((energy_type)::text = ANY (ARRAY[('petrol'::character varying)::text, ('diesel'::character varying)::text, ('electric'::character varying)::text, ('hybrid'::character varying)::text])))
);


--
-- Name: fuel_budget_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fuel_budget_items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_budget_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fuel_budget_items_item_id_seq OWNED BY public.fuel_budget_items.item_id;


--
-- Name: fuel_budget_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_budget_proposals (
    proposal_id integer NOT NULL,
    budget_month date NOT NULL,
    created_by integer NOT NULL,
    justification text NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_fuel_proposal_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('submitted'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
);


--
-- Name: fuel_budget_proposals_proposal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fuel_budget_proposals_proposal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_budget_proposals_proposal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fuel_budget_proposals_proposal_id_seq OWNED BY public.fuel_budget_proposals.proposal_id;


--
-- Name: maintenance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_records (
    maintenance_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    maintenance_type character varying(100) NOT NULL,
    description text NOT NULL,
    maintenance_date date NOT NULL,
    odometer_reading integer NOT NULL,
    cost numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'in progress'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    ready_confirmed_at timestamp with time zone,
    CONSTRAINT maintenance_records_cost_check CHECK ((cost >= (0)::numeric)),
    CONSTRAINT maintenance_records_odometer_reading_check CHECK ((odometer_reading >= 0)),
    CONSTRAINT maintenance_records_status_check CHECK (((status)::text = ANY (ARRAY[('in progress'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: maintenance_records_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_records_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_records_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_records_maintenance_id_seq OWNED BY public.maintenance_records.maintenance_id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    device_info text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    employee_id text,
    firstname text,
    lastname text,
    gender text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    vehicle_id integer NOT NULL,
    plate_number character varying(20) NOT NULL,
    make character varying(20) NOT NULL,
    model character varying(20) NOT NULL,
    year integer NOT NULL,
    current_odometer integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'available'::character varying NOT NULL,
    assigned_driver_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_vehicle_status CHECK (((status)::text = ANY (ARRAY[('available'::character varying)::text, ('in use'::character varying)::text, ('maintenance'::character varying)::text, ('out of service'::character varying)::text])))
);


--
-- Name: vehicles_vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicles_vehicle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicles_vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicles_vehicle_id_seq OWNED BY public.vehicles.vehicle_id;


--
-- Name: fuel_budget_items item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_items ALTER COLUMN item_id SET DEFAULT nextval('public.fuel_budget_items_item_id_seq'::regclass);


--
-- Name: fuel_budget_proposals proposal_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_proposals ALTER COLUMN proposal_id SET DEFAULT nextval('public.fuel_budget_proposals_proposal_id_seq'::regclass);


--
-- Name: maintenance_records maintenance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_records ALTER COLUMN maintenance_id SET DEFAULT nextval('public.maintenance_records_maintenance_id_seq'::regclass);


--
-- Name: vehicles vehicle_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN vehicle_id SET DEFAULT nextval('public.vehicles_vehicle_id_seq'::regclass);


--
-- Name: fuel_budget_items fuel_budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_items
    ADD CONSTRAINT fuel_budget_items_pkey PRIMARY KEY (item_id);


--
-- Name: fuel_budget_proposals fuel_budget_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_proposals
    ADD CONSTRAINT fuel_budget_proposals_pkey PRIMARY KEY (proposal_id);


--
-- Name: maintenance_records maintenance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_records
    ADD CONSTRAINT maintenance_records_pkey PRIMARY KEY (maintenance_id);


--
-- Name: fuel_budget_items unique_vehicle_per_proposal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_items
    ADD CONSTRAINT unique_vehicle_per_proposal UNIQUE (proposal_id, vehicle_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (vehicle_id);


--
-- Name: vehicles vehicles_plate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_number_key UNIQUE (plate_number);


--
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: vehicles fk_assigned_driver; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT fk_assigned_driver FOREIGN KEY (assigned_driver_id) REFERENCES public.users(employee_id);


--
-- Name: fuel_budget_items fuel_budget_items_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_items
    ADD CONSTRAINT fuel_budget_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.fuel_budget_proposals(proposal_id) ON DELETE CASCADE;


--
-- Name: fuel_budget_items fuel_budget_items_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_items
    ADD CONSTRAINT fuel_budget_items_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id);


--
-- Name: fuel_budget_proposals fuel_budget_proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_budget_proposals
    ADD CONSTRAINT fuel_budget_proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: maintenance_records maintenance_records_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_records
    ADD CONSTRAINT maintenance_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id);


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


